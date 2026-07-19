import { getAIProvider, getProviderDefaultCapabilities, modelDescriptor } from '../ai/providers'
import { AIProviderError, mergeCapabilities, type ConnectionValidation, type ResolvedAIProvider } from '../ai/provider'
import { readProjectLocalConfig } from './localProjectConfig'
import type { AIProviderConfig, AIProviderKind, ModelCapabilities, StructuredAIRequest, StructuredAIResponse } from './types'

export type AIProviderStatus = {
  configured: boolean
  available: boolean
  mode: 'none' | 'byom' | 'verion_ai'
  provider?: {
    id: string
    kind: AIProviderKind
    label: string
    model: string
    capabilities: ModelCapabilities
  }
  message?: string
}

let environmentLoaded = false

export function loadLocalEnvironment() {
  if (environmentLoaded) return
  environmentLoaded = true
  try {
    process.loadEnvFile()
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (code !== 'ENOENT') throw error
  }
}

/**
 * Resolves a selected provider locally. This boundary deliberately returns a
 * runtime-only API key; callers must never serialize the result or return it
 * through the local HTTP server.
 */
export async function resolveAIProvider(projectRoot = process.cwd()): Promise<ResolvedAIProvider | undefined> {
  loadLocalEnvironment()
  const providerConfig = environmentProviderConfig() ?? await storedProviderConfig(projectRoot) ?? legacyOpenAIConfig()
  if (!providerConfig || !providerConfig.enabled) return undefined
  const modelId = selectedModelId(providerConfig)
  if (!modelId) return undefined
  const provider = getAIProvider(providerConfig.provider)
  const endpoint = validatedEndpoint(providerConfig.endpoint, providerConfig.provider)
  const apiKey = credentialFor(providerConfig)
  return {
    config: endpoint ? { ...providerConfig, endpoint } : providerConfig,
    endpoint,
    apiKey,
    model: modelDescriptor(providerConfig, modelId, mergeCapabilities(provider.defaultCapabilities, providerConfig.capabilities))
  }
}

export async function getAIProviderStatus(projectRoot = process.cwd()): Promise<AIProviderStatus> {
  loadLocalEnvironment()
  const providerConfig = environmentProviderConfig() ?? await storedProviderConfig(projectRoot) ?? legacyOpenAIConfig()
  if (!providerConfig || !providerConfig.enabled) {
    return {
      configured: false,
      available: false,
      mode: 'none',
      message: 'No AI provider is connected. Verion will keep learning and reviewing locally.'
    }
  }
  const modelId = selectedModelId(providerConfig)
  const capabilities = mergeCapabilities(getProviderDefaultCapabilities(providerConfig.provider), providerConfig.capabilities)
  const base = {
    configured: true,
    mode: providerConfig.provider === 'verion_ai' ? 'verion_ai' as const : 'byom' as const,
    provider: {
      id: providerConfig.id,
      kind: providerConfig.provider,
      label: providerConfig.label,
      model: modelId ?? 'No model selected',
      capabilities
    }
  }
  if (providerConfig.provider === 'verion_ai') {
    return { ...base, available: false, message: 'Verion AI is not available in this local build. Choose a BYOM provider or continue with deterministic review.' }
  }
  if (!modelId) return { ...base, available: false, message: `${providerConfig.label} needs a model selection before Verion can use it.` }
  if (providerConfig.credentialSource === 'none' && providerConfig.provider === 'ollama') {
    if (!validatedEndpoint(providerConfig.endpoint, providerConfig.provider)) {
      return { ...base, available: false, message: `${providerConfig.label} needs a local endpoint. Use the default local runtime URL or choose a localhost URL.` }
    }
    return { ...base, available: true }
  }
  if (providerConfig.credentialSource === 'os_keychain') {
    return { ...base, available: false, message: `${providerConfig.label} is saved for OS credential storage, which is not available in this build. Use an environment variable instead.` }
  }
  if (!credentialFor(providerConfig)) {
    return { ...base, available: false, message: `${providerConfig.label} needs a local API key. Set ${credentialHint(providerConfig)} and restart Verion.` }
  }
  if (!validatedEndpoint(providerConfig.endpoint, providerConfig.provider)) {
    return { ...base, available: false, message: `${providerConfig.label} has an invalid API base URL. Use HTTPS, or a localhost HTTP URL for local development.` }
  }
  return { ...base, available: true }
}

export async function executeStructuredAI<T>(projectRoot: string, request: StructuredAIRequest): Promise<StructuredAIResponse<T>> {
  const status = await getAIProviderStatus(projectRoot)
  if (!status.available || !status.provider) throw new AIProviderError(status.message ?? 'No AI provider is ready.', 'unavailable')
  if (!status.provider.capabilities.structuredOutput) {
    throw new AIProviderError(`${status.provider.label} cannot produce the structured result Verion needs for this task. Choose a structured-output model or continue with deterministic review.`, 'capability')
  }
  const runtime = await resolveAIProvider(projectRoot)
  if (!runtime) throw new AIProviderError('No AI provider is ready.', 'unavailable')
  return getAIProvider(runtime.config.provider).structured<T>(runtime, request)
}

/** Native repair is deliberately narrower than general structured AI. */
export async function nativeRepairAvailability(projectRoot = process.cwd()): Promise<{ available: boolean; message?: string }> {
  const status = await getAIProviderStatus(projectRoot)
  const capabilities = status.provider?.capabilities
  if (!status.available || !status.provider || !capabilities) return { available: false, message: status.message }
  if (!capabilities.structuredOutput || !capabilities.codeGeneration || !capabilities.codeEditing) return { available: false, message: 'The selected model cannot prepare safe local repairs.' }
  const runtime = await resolveAIProvider(projectRoot)
  if (!runtime || !getAIProvider(runtime.config.provider).proposeRepair) return { available: false, message: 'The selected model does not implement safe repair proposals.' }
  return { available: true }
}

export async function executeRepairProposal<T>(projectRoot: string, request: StructuredAIRequest): Promise<StructuredAIResponse<T>> {
  const available = await nativeRepairAvailability(projectRoot)
  if (!available.available) throw new AIProviderError(available.message ?? 'The selected model cannot prepare safe local repairs.', 'capability')
  const runtime = await resolveAIProvider(projectRoot)
  if (!runtime) throw new AIProviderError('No AI provider is ready.', 'unavailable')
  const proposal = getAIProvider(runtime.config.provider).proposeRepair
  if (!proposal) throw new AIProviderError('The selected model cannot prepare safe local repairs.', 'capability')
  return proposal(runtime, request as import('../ai/provider').AIRepairRequest) as Promise<StructuredAIResponse<T>>
}

/** Safe to expose through a local status endpoint: the result contains no credential. */
export async function validateAIProviderConnection(projectRoot = process.cwd()): Promise<ConnectionValidation> {
  const status = await getAIProviderStatus(projectRoot)
  if (!status.available || !status.provider) {
    return { providerId: status.provider?.id ?? 'none', modelId: status.provider?.model ?? 'none', valid: false, message: status.message ?? 'No AI provider is ready.' }
  }
  const runtime = await resolveAIProvider(projectRoot)
  if (!runtime) return { providerId: status.provider.id, modelId: status.provider.model, valid: false, message: 'No AI provider is ready.' }
  return getAIProvider(runtime.config.provider).validateConnection(runtime)
}

async function storedProviderConfig(projectRoot: string): Promise<AIProviderConfig | undefined> {
  const config = await readProjectLocalConfig(projectRoot)
  if (!config) return undefined
  const selected = config.ai.selectedProviderId
    ? config.ai.providers.find((provider) => provider.id === config.ai.selectedProviderId)
    : config.ai.providers.find((provider) => provider.enabled)
  return selected?.enabled ? selected : undefined
}

function environmentProviderConfig(): AIProviderConfig | undefined {
  const provider = parseProvider(process.env.VERION_AI_PROVIDER)
  if (!provider) return undefined
  const now = new Date().toISOString()
  const model = cleanEnv('VERION_AI_MODEL') ?? providerModelFromEnvironment(provider)
  return {
    id: `environment:${provider}`,
    provider,
    label: providerLabel(provider),
    enabled: true,
    ...(environmentEndpoint(provider) ? { endpoint: environmentEndpoint(provider) } : {}),
    ...(provider === 'openai_compatible' ? { apiStyle: parseApiStyle(cleanEnv('VERION_OPENAI_COMPATIBLE_API_STYLE')) ?? 'chat_completions' } : provider === 'ollama' ? { apiStyle: 'chat_completions' as const } : {}),
    ...(model ? { selectedModelId: model } : {}),
    credentialSource: provider === 'verion_ai' ? 'verion_proxy' : provider === 'ollama' ? 'none' : 'environment',
    ...(credentialEnvironmentName(provider) ? { credentialReference: credentialEnvironmentName(provider) } : {}),
    createdAt: now,
    updatedAt: now
  }
}

function legacyOpenAIConfig(): AIProviderConfig | undefined {
  if (!cleanEnv('OPENAI_API_KEY')) return undefined
  const now = new Date().toISOString()
  return {
    id: 'environment:openai',
    provider: 'openai_compatible',
    label: 'OpenAI',
    enabled: true,
    endpoint: cleanEnv('VERION_OPENAI_COMPATIBLE_BASE_URL') ?? 'https://api.openai.com/v1',
    apiStyle: 'responses',
    ...(cleanEnv('VERION_OPENAI_MODEL') ? { selectedModelId: cleanEnv('VERION_OPENAI_MODEL') } : {}),
    credentialSource: 'environment',
    credentialReference: 'OPENAI_API_KEY',
    createdAt: now,
    updatedAt: now
  }
}

function selectedModelId(config: AIProviderConfig): string | undefined {
  return config.selectedModelId?.trim() || providerModelFromEnvironment(config.provider)
}

function providerModelFromEnvironment(provider: AIProviderKind): string | undefined {
  if (provider === 'openai_compatible') return cleanEnv('VERION_OPENAI_COMPATIBLE_MODEL') ?? cleanEnv('VERION_OPENAI_MODEL')
  if (provider === 'gemini') return cleanEnv('VERION_GEMINI_MODEL')
  if (provider === 'openrouter') return cleanEnv('VERION_OPENROUTER_MODEL')
  if (provider === 'ollama') return cleanEnv('VERION_OLLAMA_MODEL')
  return undefined
}

function environmentEndpoint(provider: AIProviderKind): string | undefined {
  return cleanEnv('VERION_AI_BASE_URL') ?? (provider === 'openai_compatible' ? cleanEnv('VERION_OPENAI_COMPATIBLE_BASE_URL') : provider === 'gemini' ? cleanEnv('VERION_GEMINI_BASE_URL') : provider === 'openrouter' ? cleanEnv('VERION_OPENROUTER_BASE_URL') : provider === 'ollama' ? cleanEnv('VERION_OLLAMA_BASE_URL') : undefined)
}

function credentialFor(config: AIProviderConfig): string | undefined {
  if (config.credentialSource !== 'environment') return undefined
  const preferred = config.credentialReference && validEnvironmentName(config.credentialReference) ? config.credentialReference : credentialEnvironmentName(config.provider)
  const names = [preferred, ...fallbackCredentialEnvironmentNames(config.provider)].filter((value): value is string => Boolean(value))
  for (const name of new Set(names)) {
    const value = cleanEnv(name)
    if (value) return value
  }
  return undefined
}

function credentialEnvironmentName(provider: AIProviderKind): string | undefined {
  if (provider === 'openai_compatible') return 'VERION_OPENAI_COMPATIBLE_API_KEY'
  if (provider === 'gemini') return 'VERION_GEMINI_API_KEY'
  if (provider === 'openrouter') return 'VERION_OPENROUTER_API_KEY'
  return undefined
}

function fallbackCredentialEnvironmentNames(provider: AIProviderKind): string[] {
  if (provider === 'openai_compatible') return ['OPENAI_API_KEY']
  if (provider === 'gemini') return ['GEMINI_API_KEY']
  if (provider === 'openrouter') return ['OPENROUTER_API_KEY']
  return []
}

function credentialHint(config: AIProviderConfig): string {
  const preferred = config.credentialReference && validEnvironmentName(config.credentialReference) ? config.credentialReference : credentialEnvironmentName(config.provider)
  return preferred ?? 'the provider API-key environment variable'
}

function parseProvider(value: string | undefined): AIProviderKind | undefined {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'openai' || normalized === 'openai_compatible') return 'openai_compatible'
  if (normalized === 'gemini' || normalized === 'openrouter' || normalized === 'verion_ai' || normalized === 'ollama') return normalized
  return undefined
}

function parseApiStyle(value: string | undefined): AIProviderConfig['apiStyle'] | undefined {
  return value === 'responses' || value === 'chat_completions' ? value : undefined
}

function providerLabel(provider: AIProviderKind): string {
  if (provider === 'openai_compatible') return 'OpenAI-compatible provider'
  if (provider === 'openrouter') return 'OpenRouter'
  if (provider === 'gemini') return 'Gemini'
  if (provider === 'ollama') return 'Local model'
  return 'Verion AI'
}

function validatedEndpoint(endpoint: string | undefined, provider: AIProviderKind): string | undefined {
  const candidate = endpoint ?? defaultEndpoint(provider)
  if (!candidate) return undefined
  try {
    const parsed = new URL(candidate)
    const localHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    if (parsed.username || parsed.password || parsed.search || parsed.hash || !(parsed.protocol === 'https:' || localHttp)) return undefined
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return undefined
  }
}

function defaultEndpoint(provider: AIProviderKind): string | undefined {
  if (provider === 'openai_compatible') return 'https://api.openai.com/v1'
  if (provider === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta'
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1'
  if (provider === 'ollama') return 'http://127.0.0.1:11434/v1'
  return undefined
}

function validEnvironmentName(value: string): boolean {
  return /^[A-Z][A-Z0-9_]{0,127}$/.test(value)
}

function cleanEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}

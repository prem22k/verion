import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createDefaultProjectLocalConfig, readProjectLocalConfig, writeProjectLocalConfig } from './localProjectConfig'
import { validateAIProviderConnection } from './runtimeConfig'
import type { AIProviderConfig, AIProviderKind, ProjectLocalConfig } from './types'

const projectEnvironmentFile = '.env'
const providerKinds = new Set<AIProviderKind>(['openai_compatible', 'gemini', 'openrouter', 'ollama'])

export type ProviderSetupInput = {
  provider: AIProviderKind
  model: string
  endpoint?: string
  apiStyle?: 'responses' | 'chat_completions'
  credentialMethod: 'environment' | 'project_env' | 'none'
  credentialReference?: string
  apiKey?: string
}

export type ProviderSetupView = {
  provider: AIProviderKind
  label: string
  model: string
  credentialMethod: 'environment' | 'project_env' | 'none'
  credentialReference?: string
}

/**
 * Saves only credential-free provider preferences under .verion. A submitted
 * BYOM key is written to the project's ignored .env file with restrictive
 * permissions and is never returned, logged, or added to process responses.
 */
export async function saveProviderSetup(projectRoot: string, input: ProviderSetupInput): Promise<ProviderSetupView> {
  const normalized = normalizeInput(input)
  if (normalized.apiKey) {
    if (normalized.credentialMethod !== 'project_env' || !normalized.credentialReference) {
      throw new Error('Choose local project environment storage before adding an API key.')
    }
    await writeProjectEnvironmentValue(projectRoot, normalized.credentialReference, normalized.apiKey)
    process.env[normalized.credentialReference] = normalized.apiKey
  }

  const now = new Date().toISOString()
  const existing = await readProjectLocalConfig(projectRoot) ?? createDefaultProjectLocalConfig(now)
  const config = providerConfig(normalized, now)
  const next: ProjectLocalConfig = {
    ...existing,
    updatedAt: now,
    ai: {
      selectedProviderId: config.id,
      providers: [config, ...existing.ai.providers.filter((provider) => provider.id !== config.id).map((provider) => ({ ...provider, enabled: false, updatedAt: now }))]
    }
  }
  await writeProjectLocalConfig(projectRoot, next)
  return viewFor(config, normalized.credentialMethod)
}

export async function validateSavedProviderSetup(projectRoot: string) {
  return validateAIProviderConnection(projectRoot)
}

function normalizeInput(input: ProviderSetupInput): Required<Pick<ProviderSetupInput, 'provider' | 'model' | 'credentialMethod'>> & Pick<ProviderSetupInput, 'endpoint' | 'apiStyle' | 'credentialReference' | 'apiKey'> {
  if (!providerKinds.has(input.provider)) throw new Error('Choose a supported local or BYOM provider.')
  if (input.provider === 'verion_ai') throw new Error('Verion AI is not available in this local build.')
  const model = input.model.trim()
  if (!model || model.length > 160 || /[\r\n\0]/.test(model)) throw new Error('Choose a valid model identifier.')
  const endpoint = input.endpoint?.trim()
  if (endpoint && endpoint.length > 500) throw new Error('Use a shorter provider endpoint.')
  if (endpoint && !safeEndpoint(endpoint)) throw new Error('Use HTTPS, or a loopback HTTP endpoint for a local model.')
  const apiKey = input.apiKey?.trim()
  if (apiKey && (apiKey.length < 8 || apiKey.length > 4_096 || /[\r\n\0]/.test(apiKey))) throw new Error('Use a valid API key.')
  if (input.provider === 'ollama') {
    if (input.credentialMethod !== 'none') throw new Error('A local model does not use an API key.')
    return { provider: input.provider, model, credentialMethod: 'none', ...(endpoint ? { endpoint } : {}), apiStyle: 'chat_completions' }
  }
  if (input.credentialMethod !== 'environment' && input.credentialMethod !== 'project_env') {
    throw new Error('Choose an environment variable or local project environment storage for this API key.')
  }
  const credentialReference = (input.credentialReference?.trim() || defaultCredentialReference(input.provider))
  if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(credentialReference)) throw new Error('Use a valid API-key environment variable name.')
  if (input.credentialMethod === 'environment' && apiKey) throw new Error('Set the API key in the selected environment variable, or choose local project environment storage.')
  return {
    provider: input.provider,
    model,
    credentialMethod: input.credentialMethod,
    credentialReference,
    ...(endpoint ? { endpoint } : {}),
    ...(input.provider === 'openai_compatible' ? { apiStyle: input.apiStyle ?? 'chat_completions' } : {}),
    ...(apiKey ? { apiKey } : {})
  }
}

function providerConfig(input: ReturnType<typeof normalizeInput>, now: string): AIProviderConfig {
  const provider = input.provider
  return {
    id: `project:${provider}`,
    provider,
    label: providerLabel(provider),
    enabled: true,
    ...(input.endpoint ? { endpoint: input.endpoint } : {}),
    ...(input.apiStyle ? { apiStyle: input.apiStyle } : {}),
    selectedModelId: input.model,
    credentialSource: input.credentialMethod === 'none' ? 'none' : 'environment',
    ...(input.credentialReference ? { credentialReference: input.credentialReference } : {}),
    createdAt: now,
    updatedAt: now
  }
}

function viewFor(config: AIProviderConfig, credentialMethod: ProviderSetupInput['credentialMethod']): ProviderSetupView {
  return {
    provider: config.provider,
    label: config.label,
    model: config.selectedModelId ?? '',
    credentialMethod,
    ...(config.credentialReference ? { credentialReference: config.credentialReference } : {})
  }
}

function defaultCredentialReference(provider: Exclude<AIProviderKind, 'verion_ai' | 'ollama'>): string {
  if (provider === 'openai_compatible') return 'VERION_OPENAI_COMPATIBLE_API_KEY'
  if (provider === 'gemini') return 'VERION_GEMINI_API_KEY'
  return 'VERION_OPENROUTER_API_KEY'
}

function providerLabel(provider: AIProviderKind): string {
  if (provider === 'openai_compatible') return 'OpenAI-compatible provider'
  if (provider === 'gemini') return 'Gemini'
  if (provider === 'openrouter') return 'OpenRouter'
  if (provider === 'ollama') return 'Local model'
  return 'Verion AI'
}

function safeEndpoint(value: string): boolean {
  try {
    const endpoint = new URL(value)
    const localHttp = endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    return !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash && (endpoint.protocol === 'https:' || localHttp)
  } catch {
    return false
  }
}

async function writeProjectEnvironmentValue(projectRoot: string, name: string, value: string): Promise<void> {
  const path = join(projectRoot, projectEnvironmentFile)
  let existing = ''
  try { existing = await readFile(path, 'utf8') } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (code !== 'ENOENT') throw error
  }
  const assignment = `${name}=${JSON.stringify(value)}`
  const expression = new RegExp(`^(?:export\\s+)?${escapeExpression(name)}=.*$`, 'm')
  const next = expression.test(existing)
    ? existing.replace(expression, assignment)
    : `${existing.replace(/\s*$/, '')}${existing.trim() ? '\n' : ''}${assignment}\n`
  const directory = projectRoot
  await mkdir(directory, { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, next, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, path)
  await chmod(path, 0o600)
}

function escapeExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

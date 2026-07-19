import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProjectLocalConfig } from './types'

const configDirectoryName = '.verion'
const configFileName = 'verion-config.json'

/**
 * This file records local product preferences only. It must never contain an
 * API key, bearer token, source excerpt, assistant answer, or repair diff.
 */
export async function readProjectLocalConfig(projectRoot: string): Promise<ProjectLocalConfig | undefined> {
  try {
    const value = JSON.parse(await readFile(localProjectConfigPath(projectRoot), 'utf8')) as unknown
    return normalizeProjectLocalConfig(value)
  } catch {
    return undefined
  }
}

export async function writeProjectLocalConfig(projectRoot: string, config: ProjectLocalConfig): Promise<void> {
  const normalized = normalizeProjectLocalConfig(config)
  if (!normalized) throw new Error('The local Verion configuration is not valid.')
  const directory = join(projectRoot, configDirectoryName)
  await mkdir(directory, { recursive: true })
  const target = localProjectConfigPath(projectRoot)
  const temporary = `${target}.tmp`
  await writeFile(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, target)
}

export function createDefaultProjectLocalConfig(now = new Date().toISOString()): ProjectLocalConfig {
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    ai: { providers: [] },
    assistant: {
      conversationRetention: 'local',
      suggestedQuestionsEnabled: true
    }
  }
}

export function localProjectConfigPath(projectRoot: string) {
  return join(projectRoot, configDirectoryName, configFileName)
}

function normalizeProjectLocalConfig(value: unknown): ProjectLocalConfig | undefined {
  if (!value || typeof value !== 'object') return undefined
  const config = value as Partial<ProjectLocalConfig> & { version?: unknown }
  if (config.version !== 1 || typeof config.createdAt !== 'string' || typeof config.updatedAt !== 'string') return undefined
  if (!config.ai || typeof config.ai !== 'object' || !Array.isArray(config.ai.providers)) return undefined
  if (!config.assistant || typeof config.assistant !== 'object') return undefined
  if (config.assistant.conversationRetention !== 'local' && config.assistant.conversationRetention !== 'none') return undefined
  if (typeof config.assistant.suggestedQuestionsEnabled !== 'boolean') return undefined
  const providers = config.ai.providers.filter(isCredentialFreeProviderConfig)
  if (providers.length !== config.ai.providers.length) return undefined
  return {
    version: 1,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    ai: {
      ...(typeof config.ai.selectedProviderId === 'string' ? { selectedProviderId: config.ai.selectedProviderId } : {}),
      providers
    },
    assistant: {
      conversationRetention: config.assistant.conversationRetention,
      suggestedQuestionsEnabled: config.assistant.suggestedQuestionsEnabled
    }
  }
}

function isCredentialFreeProviderConfig(value: unknown): value is ProjectLocalConfig['ai']['providers'][number] {
  if (!value || typeof value !== 'object') return false
  const provider = value as Record<string, unknown>
  const allowedKeys = new Set(['id', 'provider', 'label', 'enabled', 'endpoint', 'apiStyle', 'selectedModelId', 'capabilities', 'credentialSource', 'credentialReference', 'createdAt', 'updatedAt'])
  if (Object.keys(provider).some((key) => !allowedKeys.has(key))) return false
  if (typeof provider.id !== 'string' || typeof provider.label !== 'string' || typeof provider.enabled !== 'boolean') return false
  if (!['verion_ai', 'openai_compatible', 'gemini', 'openrouter', 'ollama'].includes(String(provider.provider))) return false
  if (!['verion_proxy', 'environment', 'os_keychain', 'none'].includes(String(provider.credentialSource))) return false
  if (provider.credentialSource === 'verion_proxy' && provider.provider !== 'verion_ai') return false
  if (provider.credentialSource !== 'verion_proxy' && provider.provider === 'verion_ai') return false
  if (provider.credentialSource === 'none' && provider.provider !== 'ollama') return false
  if (provider.provider === 'ollama' && provider.credentialSource !== 'none') return false
  if (provider.endpoint !== undefined && (typeof provider.endpoint !== 'string' || !isSafeEndpoint(provider.endpoint))) return false
  if (provider.apiStyle !== undefined && provider.apiStyle !== 'responses' && provider.apiStyle !== 'chat_completions') return false
  if (provider.selectedModelId !== undefined && typeof provider.selectedModelId !== 'string') return false
  if (provider.capabilities !== undefined && !isCapabilities(provider.capabilities)) return false
  if (provider.credentialReference !== undefined && (typeof provider.credentialReference !== 'string' || looksLikeSecret(provider.credentialReference))) return false
  if (provider.credentialSource === 'environment' && provider.credentialReference !== undefined && !/^[A-Z][A-Z0-9_]{0,127}$/.test(provider.credentialReference)) return false
  if (typeof provider.createdAt !== 'string' || typeof provider.updatedAt !== 'string') return false
  if ([provider.id, provider.label, provider.selectedModelId, provider.endpoint].some((item) => typeof item === 'string' && looksLikeSecret(item))) return false
  return true
}

function isCapabilities(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const capabilities = value as Record<string, unknown>
  const allowed = new Set(['structuredOutput', 'largeContext', 'toolCalling', 'reasoning', 'vision', 'codeGeneration', 'codeEditing'])
  return Object.entries(capabilities).every(([key, capability]) => allowed.has(key) && typeof capability === 'boolean')
}

function isSafeEndpoint(value: string): boolean {
  try {
    const endpoint = new URL(value)
    const localHttp = endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    return !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash && (endpoint.protocol === 'https:' || localHttp)
  } catch {
    return false
  }
}

function looksLikeSecret(value: string): boolean {
  return /(?:^|\s)(?:sk[-_]|AIza|or-)[A-Za-z0-9_-]{8,}/.test(value) || /(?:api[ _-]?key|authorization|token)\s*[:=]\s*(?:Bearer\s+)?\S+/i.test(value)
}

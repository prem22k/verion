import type { AIProviderConfig, ModelCapabilities, ModelDescriptor, StructuredAIRequest, StructuredAIResponse } from '../core/types'
import { AIProviderError, type AIProvider, type ConnectionValidation, type ResolvedAIProvider } from './provider'

const openAiCapabilities: ModelCapabilities = {
  structuredOutput: true,
  largeContext: true,
  toolCalling: true,
  reasoning: true,
  vision: true,
  codeGeneration: true,
  codeEditing: false
}

const geminiCapabilities: ModelCapabilities = {
  structuredOutput: true,
  largeContext: true,
  toolCalling: true,
  reasoning: true,
  vision: true,
  codeGeneration: true,
  codeEditing: false
}

const openRouterCapabilities: ModelCapabilities = {
  structuredOutput: true,
  largeContext: true,
  toolCalling: true,
  reasoning: false,
  vision: false,
  codeGeneration: true,
  codeEditing: false
}

const ollamaCapabilities: ModelCapabilities = {
  structuredOutput: true,
  largeContext: false,
  toolCalling: false,
  reasoning: false,
  vision: false,
  codeGeneration: true,
  codeEditing: false
}

class OpenAICompatibleProvider implements AIProvider {
  constructor(readonly kind: Extract<AIProvider['kind'], 'openai_compatible' | 'ollama'> = 'openai_compatible', readonly defaultCapabilities: ModelCapabilities = openAiCapabilities) {}

  async structured<T>(runtime: ResolvedAIProvider, request: StructuredAIRequest): Promise<StructuredAIResponse<T>> {
    const key = runtime.config.provider === 'ollama' ? undefined : requireCredential(runtime)
    const apiStyle = runtime.config.apiStyle ?? 'chat_completions'
    const response = apiStyle === 'responses'
      ? await requestJson(joinEndpoint(runtime.endpoint ?? defaultEndpoint(this.kind), 'responses'), {
          method: 'POST',
          headers: authorizationHeaders(key),
          body: JSON.stringify({
            model: runtime.model.id,
            store: false,
            max_output_tokens: maxOutputTokens(request),
            input: [
              { role: 'system', content: request.instructions },
              { role: 'user', content: JSON.stringify(request.input) }
            ],
            text: { format: { type: 'json_schema', name: request.schemaName, strict: true, schema: request.schema } }
          }),
          providerLabel: runtime.config.label
        })
      : await requestJson(joinEndpoint(runtime.endpoint ?? defaultEndpoint(this.kind), 'chat/completions'), {
          method: 'POST',
          headers: authorizationHeaders(key),
          body: JSON.stringify({
            model: runtime.model.id,
            max_tokens: maxOutputTokens(request),
            messages: [
              { role: 'system', content: request.instructions },
              { role: 'user', content: JSON.stringify(request.input) }
            ],
            response_format: { type: 'json_schema', json_schema: { name: request.schemaName, strict: true, schema: request.schema } }
          }),
          providerLabel: runtime.config.label
        })

    const text = apiStyle === 'responses' ? responseOutputText(response) : chatCompletionText(response)
    return structuredResult<T>(text, runtime)
  }

  async validateConnection(runtime: ResolvedAIProvider): Promise<ConnectionValidation> {
    const key = runtime.config.provider === 'ollama' ? undefined : requireCredential(runtime)
    const response = await requestJson(joinEndpoint(runtime.endpoint ?? defaultEndpoint(this.kind), `models/${encodeURIComponent(runtime.model.id)}`), {
      method: 'GET',
      headers: authorizationHeaders(key),
      providerLabel: runtime.config.label
    })
    if (!response || typeof response !== 'object') throw new AIProviderError(`${runtime.config.label} returned an invalid model response.`)
    return validConnection(runtime)
  }

  async proposeRepair<T = never>(runtime: ResolvedAIProvider, request: StructuredAIRequest): Promise<StructuredAIResponse<T>> {
    return this.structured<T>(runtime, request)
  }
}

class GeminiProvider implements AIProvider {
  readonly kind = 'gemini' as const
  readonly defaultCapabilities = geminiCapabilities

  async structured<T>(runtime: ResolvedAIProvider, request: StructuredAIRequest): Promise<StructuredAIResponse<T>> {
    const key = requireCredential(runtime)
    const response = await requestJson(joinEndpoint(runtime.endpoint ?? defaultEndpoint(this.kind), `models/${encodeURIComponent(runtime.model.id)}:generateContent`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.instructions }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(request.input) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: request.schema,
          maxOutputTokens: maxOutputTokens(request)
        }
      }),
      providerLabel: runtime.config.label
    })
    return structuredResult<T>(geminiText(response), runtime)
  }

  async validateConnection(runtime: ResolvedAIProvider): Promise<ConnectionValidation> {
    const key = requireCredential(runtime)
    const response = await requestJson(joinEndpoint(runtime.endpoint ?? defaultEndpoint(this.kind), `models/${encodeURIComponent(runtime.model.id)}`), {
      method: 'GET',
      headers: { 'x-goog-api-key': key },
      providerLabel: runtime.config.label
    })
    if (!response || typeof response !== 'object') throw new AIProviderError(`${runtime.config.label} returned an invalid model response.`)
    return validConnection(runtime)
  }

  async proposeRepair<T = never>(runtime: ResolvedAIProvider, request: StructuredAIRequest): Promise<StructuredAIResponse<T>> {
    return this.structured<T>(runtime, request)
  }
}

class OpenRouterProvider implements AIProvider {
  readonly kind = 'openrouter' as const
  readonly defaultCapabilities = openRouterCapabilities

  async structured<T>(runtime: ResolvedAIProvider, request: StructuredAIRequest): Promise<StructuredAIResponse<T>> {
    const key = requireCredential(runtime)
    const response = await requestJson(joinEndpoint(runtime.endpoint ?? defaultEndpoint(this.kind), 'chat/completions'), {
      method: 'POST',
      headers: authorizationHeaders(key),
      body: JSON.stringify({
        model: runtime.model.id,
        max_tokens: maxOutputTokens(request),
        messages: [
          { role: 'system', content: request.instructions },
          { role: 'user', content: JSON.stringify(request.input) }
        ],
        response_format: { type: 'json_schema', json_schema: { name: request.schemaName, strict: true, schema: request.schema } },
        provider: { require_parameters: true }
      }),
      providerLabel: runtime.config.label
    })
    return structuredResult<T>(chatCompletionText(response), runtime)
  }

  async validateConnection(runtime: ResolvedAIProvider): Promise<ConnectionValidation> {
    const key = requireCredential(runtime)
    const response = await requestJson(joinEndpoint(runtime.endpoint ?? defaultEndpoint(this.kind), 'models'), {
      method: 'GET',
      headers: authorizationHeaders(key),
      providerLabel: runtime.config.label
    })
    const models = response && typeof response === 'object' && 'data' in response && Array.isArray(response.data) ? response.data : []
    if (!models.some((model) => model && typeof model === 'object' && 'id' in model && model.id === runtime.model.id)) {
      throw new AIProviderError(`${runtime.config.label} cannot use the selected model. Choose a model available to this account.`)
    }
    return validConnection(runtime)
  }

  async proposeRepair<T = never>(runtime: ResolvedAIProvider, request: StructuredAIRequest): Promise<StructuredAIResponse<T>> {
    return this.structured<T>(runtime, request)
  }
}

class UnavailableVerionAIProvider implements AIProvider {
  readonly kind = 'verion_ai' as const
  readonly defaultCapabilities: ModelCapabilities = {
    structuredOutput: false,
    largeContext: false,
    toolCalling: false,
    reasoning: false,
    vision: false,
    codeGeneration: false,
    codeEditing: false
  }

  async structured<T>(_runtime: ResolvedAIProvider, _request: StructuredAIRequest): Promise<StructuredAIResponse<T>> {
    throw new AIProviderError('Verion AI is not available in this local build. Choose a local BYOM provider or continue with deterministic review.', 'unavailable')
  }

  async validateConnection(runtime: ResolvedAIProvider): Promise<ConnectionValidation> {
    return { providerId: runtime.config.id, modelId: runtime.model.id, valid: false, message: 'Verion AI is not available in this local build.' }
  }
}

const providers: Record<AIProvider['kind'], AIProvider> = {
  openai_compatible: new OpenAICompatibleProvider(),
  ollama: new OpenAICompatibleProvider('ollama', ollamaCapabilities),
  gemini: new GeminiProvider(),
  openrouter: new OpenRouterProvider(),
  verion_ai: new UnavailableVerionAIProvider()
}

export function getAIProvider(kind: AIProvider['kind']): AIProvider {
  return providers[kind]
}

export function getProviderDefaultCapabilities(kind: AIProvider['kind']): ModelCapabilities {
  return getAIProvider(kind).defaultCapabilities
}

export function modelDescriptor(config: AIProviderConfig, modelId: string, capabilities: ModelCapabilities): ModelDescriptor {
  return { id: modelId, providerId: config.id, label: modelId, capabilities }
}

function defaultEndpoint(kind: AIProvider['kind']): string {
  switch (kind) {
    case 'openai_compatible': return 'https://api.openai.com/v1'
    case 'gemini': return 'https://generativelanguage.googleapis.com/v1beta'
    case 'openrouter': return 'https://openrouter.ai/api/v1'
    case 'ollama': return 'http://127.0.0.1:11434/v1'
    case 'verion_ai': return 'https://api.verion.local'
  }
}

function requireCredential(runtime: ResolvedAIProvider): string {
  if (!runtime.apiKey) throw new AIProviderError(`${runtime.config.label} needs a local API key before Verion can use it.`, 'unavailable')
  return runtime.apiKey
}

function authorizationHeaders(apiKey: string | undefined): Record<string, string> {
  return { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), 'Content-Type': 'application/json' }
}

function joinEndpoint(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, '')
  return `${normalizedBase}/${path.replace(/^\/+/, '')}`
}

async function requestJson(url: string, init: RequestInit & { providerLabel: string }): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) })
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AIProviderError(`${init.providerLabel} did not respond before Verion's 45 second timeout.`, 'timeout')
    }
    throw new AIProviderError(`Verion could not reach ${init.providerLabel}. Check the local network connection and try again.`, 'request')
  }
  if (!response.ok) throw await providerFailure(response, init.providerLabel)
  try {
    return await response.json() as unknown
  } catch {
    throw new AIProviderError(`${init.providerLabel} returned an invalid response.`, 'request')
  }
}

async function providerFailure(response: Response, providerLabel: string): Promise<AIProviderError> {
  if (response.status === 401 || response.status === 403) {
    return new AIProviderError(`${providerLabel} rejected the local API key or selected model. Check the provider settings and try again.`, 'authentication')
  }
  if (response.status === 429) return new AIProviderError(`${providerLabel} is temporarily rate-limiting Verion. Try again shortly.`, 'rate_limit')
  if (response.status >= 500) return new AIProviderError(`${providerLabel} is temporarily unavailable. Try again shortly.`, 'request')
  const detail = await safeProviderError(response)
  return new AIProviderError(detail ? `${providerLabel} rejected this request: ${detail}` : `${providerLabel} rejected this request. Check the selected model and provider settings.`, 'request')
}

async function safeProviderError(response: Response): Promise<string | undefined> {
  try {
    const value = await response.json() as unknown
    if (!value || typeof value !== 'object') return undefined
    const record = value as Record<string, unknown>
    const error = record.error
    const message = typeof error === 'string'
      ? error
      : error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string'
        ? (error as Record<string, unknown>).message as string
        : typeof record.message === 'string' ? record.message : undefined
    return message
      ?.replace(/(?:sk[-_]|AIza|or-)[A-Za-z0-9_-]+/g, '[REDACTED]')
      .replace(/(?:api[ _-]?key|authorization|token)\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi, 'sensitive value [REDACTED]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240)
  } catch {
    return undefined
  }
}

function responseOutputText(value: unknown): string {
  if (!value || typeof value !== 'object' || typeof (value as Record<string, unknown>).output_text !== 'string') {
    throw new AIProviderError('The selected provider returned no structured result.')
  }
  return (value as Record<string, unknown>).output_text as string
}

function chatCompletionText(value: unknown): string {
  if (!value || typeof value !== 'object') throw new AIProviderError('The selected provider returned no structured result.')
  const choices = (value as Record<string, unknown>).choices
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') throw new AIProviderError('The selected provider returned no structured result.')
  const message = (choices[0] as Record<string, unknown>).message
  if (!message || typeof message !== 'object') throw new AIProviderError('The selected provider returned no structured result.')
  const content = (message as Record<string, unknown>).content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const text = content.flatMap((part) => part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string' ? [(part as Record<string, unknown>).text as string] : []).join('')
    if (text) return text
  }
  throw new AIProviderError('The selected provider returned no structured result.')
}

function geminiText(value: unknown): string {
  if (!value || typeof value !== 'object') throw new AIProviderError('The selected provider returned no structured result.')
  const candidates = (value as Record<string, unknown>).candidates
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== 'object') throw new AIProviderError('The selected provider returned no structured result.')
  const content = (candidates[0] as Record<string, unknown>).content
  if (!content || typeof content !== 'object') throw new AIProviderError('The selected provider returned no structured result.')
  const parts = (content as Record<string, unknown>).parts
  if (!Array.isArray(parts)) throw new AIProviderError('The selected provider returned no structured result.')
  const text = parts.flatMap((part) => part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string' ? [(part as Record<string, unknown>).text as string] : []).join('')
  if (!text) throw new AIProviderError('The selected provider returned no structured result.')
  return text
}

function structuredResult<T>(text: string, runtime: ResolvedAIProvider): StructuredAIResponse<T> {
  try {
    return { value: JSON.parse(text) as T, providerId: runtime.config.id, modelId: runtime.model.id, completedAt: new Date().toISOString() }
  } catch {
    throw new AIProviderError('The selected provider returned malformed structured output.')
  }
}

function maxOutputTokens(request: StructuredAIRequest): number {
  if (request.task === 'project_understanding') return 600
  if (request.task === 'release_reasoning') return 1_000
  return 1_200
}

function validConnection(runtime: ResolvedAIProvider): ConnectionValidation {
  return { providerId: runtime.config.id, modelId: runtime.model.id, valid: true, message: `${runtime.config.label} can use ${runtime.model.label}.` }
}

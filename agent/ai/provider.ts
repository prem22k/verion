import type { AIProviderConfig, AIProviderKind, ModelCapabilities, ModelDescriptor, RepairProposal, StructuredAIRequest, StructuredAIResponse } from '../core/types'

export type ResolvedAIProvider = {
  config: AIProviderConfig
  model: ModelDescriptor
  apiKey?: string
  endpoint?: string
}

export type ConnectionValidation = {
  providerId: string
  modelId: string
  valid: boolean
  message: string
}

/** Phase 1 defines these extension points; assistant and repair UI arrive later. */
export type AIChatRequest = {
  instructions: string
  input: unknown
}

export type AIChatResponse = {
  content: string
  providerId: string
  modelId: string
  completedAt: string
}

export type AIRepairRequest = StructuredAIRequest & {
  task: 'repair_proposal'
}

export interface AIProvider {
  readonly kind: AIProviderKind
  readonly defaultCapabilities: ModelCapabilities
  structured<T>(runtime: ResolvedAIProvider, request: StructuredAIRequest): Promise<StructuredAIResponse<T>>
  chat?(runtime: ResolvedAIProvider, request: AIChatRequest): Promise<AIChatResponse>
  proposeRepair?(runtime: ResolvedAIProvider, request: AIRepairRequest): Promise<StructuredAIResponse<RepairProposal>>
  validateConnection(runtime: ResolvedAIProvider): Promise<ConnectionValidation>
}

export class AIProviderError extends Error {
  constructor(message: string, readonly category: 'unavailable' | 'capability' | 'authentication' | 'rate_limit' | 'timeout' | 'request' = 'request') {
    super(message)
    this.name = 'AIProviderError'
  }
}

export const noCapabilities: ModelCapabilities = {
  structuredOutput: false,
  largeContext: false,
  toolCalling: false,
  reasoning: false,
  vision: false,
  codeGeneration: false,
  codeEditing: false
}

export function mergeCapabilities(defaults: ModelCapabilities, overrides?: Partial<ModelCapabilities>): ModelCapabilities {
  return { ...defaults, ...overrides }
}

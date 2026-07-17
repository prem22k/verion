import { getGptDiagnosisConfig, getGptDiagnosisStatus } from './runtimeConfig'
import type { ProjectDiscovery, ProjectModelUnderstanding, ProjectUnderstanding, ProjectUnderstandingItem } from './types'

const understandingSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    thesis: { type: 'string' },
    keyEntities: { type: 'array', maxItems: 5, items: { type: 'string' } },
    priorityJourneys: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['label', 'reason']
      }
    },
    reviewFocus: { type: 'string' }
  },
  required: ['thesis', 'keyEntities', 'priorityJourneys', 'reviewFocus']
}

type ModelOutline = {
  packageName?: string
  framework: string
  fileCount: number
  routeCount: number
  apiCount: number
  technologies: string[]
  productAreas: string[]
  inferredApplicationType: string
  detectedAuthentication?: string
  detectedPayments?: string
  detectedDatabase?: string
  routes: string[]
  importantPages: string[]
  importantApis: string[]
  likelyJourneys: string[]
  sourceMap: string[]
  scriptNames: string[]
}

export async function enrichProjectUnderstanding(discovery: ProjectDiscovery, understanding: ProjectUnderstanding): Promise<ProjectModelUnderstanding | undefined> {
  if (!getGptDiagnosisStatus().configured) return undefined
  const { apiKey, model } = getGptDiagnosisConfig()
  const outline = projectOutline(discovery, understanding)

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 600,
      input: [
        {
          role: 'system',
          content: [
            'You are Verion, a local teammate learning a software project before it is reviewed.',
            'Use only the supplied project outline. It contains filenames, routes, dependency names, and deterministic local inferences, but never source code or secrets.',
            'Give a careful, specific product understanding. Do not invent customers, features, integrations, or behavior not supported by the outline.',
            'The thesis must be one concise sentence beginning with "I think this is".',
            'Key entities are short nouns that a developer would recognize. Priority journeys must be a user-facing journey and a short reason it matters.',
            'Review focus must state what Verion should pay closest attention to in the next review. If the outline is thin, use fewer entities and journeys instead of guessing.'
          ].join(' ')
        },
        { role: 'user', content: JSON.stringify({ projectOutline: outline }) }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'verion_project_understanding',
          strict: true,
          schema: understandingSchema
        }
      }
    })
  })

  if (!response.ok) return undefined
  const result = await response.json() as { output_text?: unknown }
  return parseModelUnderstanding(result.output_text)
}

function projectOutline(discovery: ProjectDiscovery, understanding: ProjectUnderstanding): ModelOutline {
  return {
    packageName: discovery.packageName,
    framework: discovery.framework,
    fileCount: discovery.files.length,
    routeCount: understanding.routeCount,
    apiCount: understanding.apiCount,
    technologies: understanding.technologies.map((technology) => technology.label),
    productAreas: understanding.productAreas,
    inferredApplicationType: understanding.applicationType ?? 'web application',
    detectedAuthentication: understanding.authentication,
    detectedPayments: understanding.payments,
    detectedDatabase: understanding.database,
    routes: discovery.routes.map((route) => route.path).slice(0, 40),
    importantPages: understanding.importantPages.map((item) => item.label).slice(0, 12),
    importantApis: understanding.importantApis.map((item) => item.label).slice(0, 12),
    likelyJourneys: understanding.userJourneys.map((item) => item.label).slice(0, 8),
    sourceMap: discovery.files.filter((file) => /^(?:app|pages|src)\//.test(file)).slice(0, 100),
    scriptNames: Object.keys(discovery.scripts).sort().slice(0, 20)
  }
}

function parseModelUnderstanding(value: unknown): ProjectModelUnderstanding | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const result = parsed as Record<string, unknown>
    const thesis = safeText(result.thesis, 280)
    const reviewFocus = safeText(result.reviewFocus, 240)
    if (!thesis || !reviewFocus || !/^i think this is\b/i.test(thesis)) return undefined
    return {
      thesis,
      keyEntities: uniqueItems(strings(result.keyEntities, 5), 'entity'),
      priorityJourneys: priorityJourneys(result.priorityJourneys),
      reviewFocus,
      updatedAt: new Date().toISOString()
    }
  } catch {
    return undefined
  }
}

function priorityJourneys(value: unknown): ProjectModelUnderstanding['priorityJourneys'] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const label = safeText(record.label, 90)
    const reason = safeText(record.reason, 180)
    if (!label || !reason || seen.has(label.toLowerCase())) return []
    seen.add(label.toLowerCase())
    return [{ id: `model-journey-${index + 1}`, label, reason }]
  }).slice(0, 4)
}

function uniqueItems(values: string[], prefix: string): ProjectUnderstandingItem[] {
  const seen = new Set<string>()
  return values.flatMap((label, index) => {
    const key = label.toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    return [{ id: `model-${prefix}-${index + 1}`, label }]
  })
}

function strings(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => safeText(item, 90) ?? []).slice(0, maximum)
}

function safeText(value: unknown, maximum: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > 0 ? text.slice(0, maximum) : undefined
}

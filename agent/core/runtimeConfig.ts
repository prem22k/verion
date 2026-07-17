const defaultOpenAiModel = 'gpt-5.6'

export type GptDiagnosisStatus = {
  configured: boolean
  model: string
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

export function getGptDiagnosisStatus(): GptDiagnosisStatus {
  loadLocalEnvironment()
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const model = process.env.VERION_OPENAI_MODEL?.trim() || defaultOpenAiModel
  if (!apiKey) {
    return {
      configured: false,
      model,
      message: 'Set OPENAI_API_KEY in .env, then restart the local agent.'
    }
  }
  return { configured: true, model }
}

export function getGptDiagnosisConfig(): { apiKey: string; model: string } {
  const status = getGptDiagnosisStatus()
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!status.configured || !apiKey) throw new Error(status.message)
  return { apiKey, model: status.model }
}

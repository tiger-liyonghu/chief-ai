/**
 * LLM Router — selects optimal model parameters based on task type.
 *
 * Rules:
 * 1. If the user has configured a custom LLM provider (not deepseek),
 *    always use their chosen model with task-appropriate temperature/maxTokens.
 * 2. If the user uses the default DeepSeek, optimize parameters per task type.
 */

export type TaskType =
  | 'briefing'          // Creative + warm tone
  | 'task_extraction'   // Structured output
  | 'reply_draft'       // Writing quality
  | 'commitment_scan'   // Accuracy-critical
  | 'meeting_prep'      // Comprehensive analysis
  | 'chat'              // Conversational
  | 'classification'    // Simple classification
  | 'translation'       // Translation

export interface LLMConfig {
  provider: string
  apiKey: string
  model: string
  baseURL: string
}

export interface ModelSelection {
  model: string
  temperature: number
  maxTokens: number
}

/**
 * Default DeepSeek parameter profiles, grouped by task characteristics.
 *
 * - Fast/precise: classification, task_extraction (low temp, short output)
 * - Accurate: commitment_scan (low temp, short output)
 * - Quality writing: reply_draft, meeting_prep (medium temp, longer output)
 * - Creative/warm: briefing, chat, translation (higher temp, medium output)
 */
const DEEPSEEK_TASK_PROFILES: Record<TaskType, { temperature: number; maxTokens: number }> = {
  classification:    { temperature: 0.1, maxTokens: 300 },
  task_extraction:   { temperature: 0.1, maxTokens: 300 },
  commitment_scan:   { temperature: 0.2, maxTokens: 300 },
  reply_draft:       { temperature: 0.5, maxTokens: 500 },
  meeting_prep:      { temperature: 0.5, maxTokens: 500 },
  briefing:          { temperature: 0.7, maxTokens: 400 },
  chat:              { temperature: 0.7, maxTokens: 400 },
  translation:       { temperature: 0.7, maxTokens: 400 },
}

/**
 * Sensible defaults for non-DeepSeek providers.
 * We respect the user's chosen model but still adjust temperature/maxTokens
 * so that classification tasks stay deterministic and writing tasks stay creative.
 */
const GENERIC_TASK_PROFILES: Record<TaskType, { temperature: number; maxTokens: number }> = {
  classification:    { temperature: 0.0, maxTokens: 300 },
  task_extraction:   { temperature: 0.0, maxTokens: 300 },
  commitment_scan:   { temperature: 0.1, maxTokens: 300 },
  reply_draft:       { temperature: 0.5, maxTokens: 500 },
  meeting_prep:      { temperature: 0.5, maxTokens: 500 },
  briefing:          { temperature: 0.7, maxTokens: 400 },
  chat:              { temperature: 0.7, maxTokens: 400 },
  translation:       { temperature: 0.5, maxTokens: 400 },
}

/**
 * Select the optimal model and parameters for a given task type.
 */
export function getModelForTask(taskType: TaskType, userConfig: LLMConfig): ModelSelection {
  const isDefaultDeepSeek = userConfig.provider === 'deepseek'

  if (isDefaultDeepSeek) {
    const profile = DEEPSEEK_TASK_PROFILES[taskType]
    return {
      model: 'deepseek-chat',
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
    }
  }

  // Custom provider: use user's chosen model, adjust only temperature/maxTokens
  const profile = GENERIC_TASK_PROFILES[taskType]
  return {
    model: userConfig.model,
    temperature: profile.temperature,
    maxTokens: profile.maxTokens,
  }
}

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
  | 'self_review'       // Deep reasoning for accuracy verification
  | 'conflict_resolution' // Complex decision-making
  | 'trip_planning'     // Multi-step travel planning

export type ModelTier = 'fast' | 'standard' | 'reasoning'

/**
 * Map task types to model tiers for 3-tier routing.
 * fast: simple queries, classifications (<100ms target)
 * standard: most tasks, single-step reasoning
 * reasoning: multi-step planning, complex decisions, self-review
 */
export const TASK_TIER: Record<TaskType, ModelTier> = {
  classification: 'fast',
  task_extraction: 'fast',
  translation: 'fast',
  commitment_scan: 'standard',
  reply_draft: 'standard',
  meeting_prep: 'standard',
  briefing: 'standard',
  chat: 'standard',
  self_review: 'reasoning',
  conflict_resolution: 'reasoning',
  trip_planning: 'reasoning',
}

/**
 * Per-provider model selection by tier.
 * Allows using different models for different complexity levels.
 */
const TIER_MODELS: Record<string, Partial<Record<ModelTier, string>>> = {
  deepseek: {
    fast: 'deepseek-chat',
    standard: 'deepseek-chat',
    reasoning: 'deepseek-reasoner',
  },
  openai: {
    fast: 'gpt-4o-mini',
    standard: 'gpt-4o',
    reasoning: 'o3-mini',
  },
  claude: {
    fast: 'claude-haiku-4-5-20251001',
    standard: 'claude-sonnet-4-6',
    reasoning: 'claude-sonnet-4-6',
  },
  groq: {
    fast: 'llama-3.3-70b-versatile',
    standard: 'llama-3.3-70b-versatile',
    reasoning: 'llama-3.3-70b-versatile',
  },
}

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
const DEEPSEEK_TASK_PROFILES: Record<TaskType, { temperature: number; maxTokens: number; model?: string }> = {
  classification:    { temperature: 0.1, maxTokens: 300 },
  task_extraction:   { temperature: 0.1, maxTokens: 300 },
  commitment_scan:   { temperature: 0.2, maxTokens: 300 },
  reply_draft:       { temperature: 0.5, maxTokens: 500 },
  meeting_prep:      { temperature: 0.5, maxTokens: 500 },
  briefing:          { temperature: 0.7, maxTokens: 400 },
  chat:              { temperature: 0.7, maxTokens: 400 },
  translation:       { temperature: 0.7, maxTokens: 400 },
  self_review:       { temperature: 0.1, maxTokens: 2000, model: 'deepseek-reasoner' },
  conflict_resolution: { temperature: 0.2, maxTokens: 1500, model: 'deepseek-reasoner' },
  trip_planning:     { temperature: 0.3, maxTokens: 1500, model: 'deepseek-reasoner' },
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
  self_review:       { temperature: 0.0, maxTokens: 2000 },
  conflict_resolution: { temperature: 0.1, maxTokens: 1500 },
  trip_planning:     { temperature: 0.2, maxTokens: 1500 },
}

/**
 * Select the optimal model and parameters for a given task type.
 * Uses 3-tier routing: fast/standard/reasoning → per-provider model.
 */
export function getModelForTask(taskType: TaskType, userConfig: LLMConfig): ModelSelection {
  const isDefaultDeepSeek = userConfig.provider === 'deepseek'
  const tier = TASK_TIER[taskType] || 'standard'

  if (isDefaultDeepSeek) {
    const profile = DEEPSEEK_TASK_PROFILES[taskType] || DEEPSEEK_TASK_PROFILES.chat
    const tierModel = TIER_MODELS.deepseek?.[tier]
    return {
      model: (profile as any).model || tierModel || 'deepseek-chat',
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
    }
  }

  // For known providers, use tier-based model selection
  const tierModels = TIER_MODELS[userConfig.provider]
  const tierModel = tierModels?.[tier]

  const profile = GENERIC_TASK_PROFILES[taskType] || GENERIC_TASK_PROFILES.chat
  return {
    model: tierModel || userConfig.model,
    temperature: profile.temperature,
    maxTokens: profile.maxTokens,
  }
}

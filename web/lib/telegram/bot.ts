/**
 * Telegram Bot API client — pure fetch, no third-party dependencies.
 *
 * All methods hit https://api.telegram.org/bot<token>/<method>.
 * Token is read from env TELEGRAM_BOT_TOKEN at call time so the module
 * stays side-effect-free and testable.
 */

const BASE = 'https://api.telegram.org'

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  return t
}

function url(method: string): string {
  return `${BASE}/bot${token()}/${method}`
}

// ---------------------------------------------------------------------------
// Types (subset of Telegram Bot API)
// ---------------------------------------------------------------------------

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  reply_to_message?: TelegramMessage
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

interface TelegramResponse<T> {
  ok: boolean
  result: T
  description?: string
  error_code?: number
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

async function call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(url(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })

  const json: TelegramResponse<T> = await res.json()

  if (!json.ok) {
    throw new Error(`Telegram API error ${json.error_code}: ${json.description}`)
  }

  return json.result
}

/**
 * getMe — returns basic info about the bot.
 */
export async function getMe(): Promise<TelegramUser> {
  return call<TelegramUser>('getMe')
}

/**
 * sendMessage — send a text message to a chat.
 *
 * Supports Markdown V2 parse mode and optional reply_to_message_id.
 */
export async function sendMessage(
  chatId: number | string,
  text: string,
  options?: {
    parseMode?: 'MarkdownV2' | 'HTML'
    replyToMessageId?: number
  },
): Promise<TelegramMessage> {
  return call<TelegramMessage>('sendMessage', {
    chat_id: chatId,
    text,
    ...(options?.parseMode && { parse_mode: options.parseMode }),
    ...(options?.replyToMessageId && { reply_to_message_id: options.replyToMessageId }),
  })
}

/**
 * getUpdates — long-polling for updates. Primarily for dev/debug;
 * production uses webhook mode.
 */
export async function getUpdates(
  offset?: number,
  limit = 100,
  timeout = 30,
): Promise<TelegramUpdate[]> {
  return call<TelegramUpdate[]>('getUpdates', {
    ...(offset !== undefined && { offset }),
    limit,
    timeout,
  })
}

/**
 * setWebhook — register a webhook URL with Telegram.
 *
 * @param webhookUrl  Public HTTPS URL (e.g. https://example.com/api/telegram/webhook)
 * @param secretToken Optional secret sent in X-Telegram-Bot-Api-Secret-Token header
 */
export async function setWebhook(
  webhookUrl: string,
  secretToken?: string,
): Promise<boolean> {
  return call<boolean>('setWebhook', {
    url: webhookUrl,
    ...(secretToken && { secret_token: secretToken }),
    allowed_updates: ['message'],
    max_connections: 40,
  })
}

/**
 * deleteWebhook — remove the current webhook (e.g. to switch to polling).
 */
export async function deleteWebhook(): Promise<boolean> {
  return call<boolean>('deleteWebhook')
}

/**
 * getWebhookInfo — check current webhook status (useful for diagnostics).
 */
export async function getWebhookInfo(): Promise<{
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
  last_error_date?: number
  last_error_message?: string
}> {
  return call('getWebhookInfo')
}

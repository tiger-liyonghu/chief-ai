/**
 * Unified channel abstraction types.
 *
 * Every messaging channel (Gmail, Outlook, WhatsApp, Telegram, etc.) maps into
 * the same UnifiedMessage shape so that upstream consumers (digest, briefing,
 * task extraction) never need to know which channel a message came from.
 */

export type ChannelProvider = 'gmail' | 'outlook' | 'whatsapp' | 'telegram'

export interface UnifiedContact {
  email?: string
  phone?: string
  name?: string
}

export interface UnifiedMessage {
  /** Provider-native message ID */
  id: string
  /** Which channel this message came from */
  channel: ChannelProvider
  /** Thread/conversation ID for grouping */
  threadId: string
  /** Sender */
  from: UnifiedContact
  /** Recipients */
  to: UnifiedContact[]
  /** Email subject or message title (optional for chat channels) */
  subject?: string
  /** Plain-text body */
  body: string
  /** Whether the user sent or received this message */
  direction: 'inbound' | 'outbound'
  /** When the message was received/sent */
  receivedAt: Date
  /** Provider-specific metadata (labels, read status, attachments, etc.) */
  metadata: Record<string, unknown>
}

export interface SendContent {
  subject?: string
  body: string
}

/**
 * Every channel connector must implement this interface.
 *
 * The `accessToken` parameter is obtained externally (via the provider's
 * token module) and passed in — connectors themselves do not manage auth.
 */
export interface ChannelConnector {
  readonly provider: ChannelProvider

  /**
   * Fetch recent messages for the given access token.
   * Returns them in reverse-chronological order (newest first).
   */
  listMessages(accessToken: string, limit?: number): Promise<UnifiedMessage[]>

  /**
   * Send a message through this channel.
   */
  sendMessage(accessToken: string, to: string, content: SendContent): Promise<void>
}

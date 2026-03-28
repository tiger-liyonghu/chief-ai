/**
 * Gmail channel connector.
 *
 * Wraps lib/google/gmail.ts into the unified ChannelConnector interface.
 * Does NOT modify any existing Gmail behaviour — pure adapter layer.
 */

import type { ChannelConnector, UnifiedMessage, SendContent } from './types'
import {
  listMessages as gmailListMessages,
  getMessage as gmailGetMessage,
  sendMessage as gmailSendMessage,
  parseEmailHeaders,
  parseEmailBody,
  createRawEmail,
} from '@/lib/google/gmail'

/** Parse "Name <email>" or bare "email" into components */
function parseAddress(raw: string): { email: string; name?: string } {
  const match = raw.match(/^(.+?)\s*<(.+)>$/)
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() }
  }
  return { email: raw.trim() }
}

export class GmailConnector implements ChannelConnector {
  readonly provider = 'gmail' as const

  async listMessages(accessToken: string, limit = 50): Promise<UnifiedMessage[]> {
    const list = await gmailListMessages(accessToken, limit)
    if (!list.messages || list.messages.length === 0) return []

    // Fetch full message details in parallel (capped at limit)
    const messageIds = list.messages.slice(0, limit).map(m => m.id!)
    const fullMessages = await Promise.all(
      messageIds.map(id => gmailGetMessage(accessToken, id))
    )

    return fullMessages.map(msg => {
      const headers = parseEmailHeaders(msg.payload?.headers as { name?: string; value?: string }[] | undefined)
      const body = parseEmailBody(msg.payload)
      const from = parseAddress(headers.from)
      const toAddresses = headers.to
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(parseAddress)

      return {
        id: msg.id!,
        channel: 'gmail' as const,
        threadId: msg.threadId || msg.id!,
        from: { email: from.email, name: from.name },
        to: toAddresses.map(a => ({ email: a.email, name: a.name })),
        subject: headers.subject || undefined,
        body,
        direction: 'inbound' as const, // listMessages defaults to inbox
        receivedAt: new Date(headers.date || msg.internalDate || Date.now()),
        metadata: {
          labelIds: msg.labelIds || [],
          snippet: msg.snippet || '',
          historyId: msg.historyId,
        },
      } satisfies UnifiedMessage
    })
  }

  async sendMessage(accessToken: string, to: string, content: SendContent): Promise<void> {
    const raw = createRawEmail(to, content.subject || '(no subject)', content.body)
    await gmailSendMessage(accessToken, raw)
  }
}

/**
 * Outlook / Microsoft 365 channel connector.
 *
 * Wraps lib/microsoft/mail.ts into the unified ChannelConnector interface.
 * Does NOT modify any existing Outlook behaviour — pure adapter layer.
 */

import type { ChannelConnector, UnifiedMessage, SendContent } from './types'
import {
  listMessages as outlookListMessages,
  sendMessage as outlookSendMessage,
  parseGraphMessage,
} from '@/lib/microsoft/mail'

export class OutlookConnector implements ChannelConnector {
  readonly provider = 'outlook' as const

  async listMessages(accessToken: string, limit = 50): Promise<UnifiedMessage[]> {
    const { messages } = await outlookListMessages(accessToken, limit)

    return messages.map(msg => {
      const parsed = parseGraphMessage(msg)

      return {
        id: parsed.messageId,
        channel: 'outlook' as const,
        threadId: parsed.threadId,
        from: {
          email: parsed.fromAddress,
          name: parsed.fromName || undefined,
        },
        to: parsed.toAddresses.map(addr => ({ email: addr })),
        subject: parsed.subject,
        body: msg.bodyPreview || '',
        direction: 'inbound' as const,
        receivedAt: new Date(parsed.receivedAt),
        metadata: {
          labels: parsed.labels,
          isRead: parsed.isRead,
          hasAttachments: msg.hasAttachments,
          isDraft: msg.isDraft,
        },
      } satisfies UnifiedMessage
    })
  }

  async sendMessage(accessToken: string, to: string, content: SendContent): Promise<void> {
    await outlookSendMessage(accessToken, to, content.subject || '(no subject)', content.body)
  }
}

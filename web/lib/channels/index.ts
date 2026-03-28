/**
 * Channel connector factory.
 *
 * Usage:
 *   const connector = getConnector('gmail')
 *   const messages = await connector.listMessages(accessToken, 20)
 */

import type { ChannelConnector, ChannelProvider } from './types'
import { GmailConnector } from './gmail'
import { OutlookConnector } from './outlook'

// Singleton instances — connectors are stateless so one per provider suffices.
const connectors: Record<string, ChannelConnector> = {
  gmail: new GmailConnector(),
  outlook: new OutlookConnector(),
}

/**
 * Get a channel connector by provider name.
 * Throws if the provider is not yet implemented.
 */
export function getConnector(provider: ChannelProvider): ChannelConnector {
  const connector = connectors[provider]
  if (!connector) {
    throw new Error(`Channel connector not implemented: ${provider}`)
  }
  return connector
}

// Re-export types for convenience
export type { ChannelConnector, ChannelProvider, UnifiedMessage, SendContent, UnifiedContact } from './types'

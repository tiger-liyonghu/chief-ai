/**
 * Microsoft Graph API — Mail operations.
 * Equivalent to lib/google/gmail.ts but for Outlook/Microsoft 365.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

interface GraphMessage {
  id: string
  conversationId: string
  subject: string
  from: { emailAddress: { name: string; address: string } }
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>
  receivedDateTime: string
  bodyPreview: string
  body: { contentType: string; content: string }
  isRead: boolean
  isDraft: boolean
  categories: string[]
  hasAttachments: boolean
}

interface GraphMessageList {
  value: GraphMessage[]
  '@odata.nextLink'?: string
  '@odata.deltaLink'?: string
}

/**
 * List messages from inbox.
 */
export async function listMessages(
  accessToken: string,
  maxResults = 200,
  deltaLink?: string,
): Promise<{ messages: GraphMessage[]; deltaLink?: string }> {
  const url = deltaLink ||
    `${GRAPH_BASE}/me/mailFolders/inbox/messages/delta?$top=${maxResults}&$select=id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,isDraft,categories,hasAttachments`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Graph listMessages failed: ${res.status} ${err?.error?.message || ''}`)
  }

  const data: GraphMessageList = await res.json()

  // Follow pagination
  let allMessages = data.value || []
  let nextLink = data['@odata.nextLink']

  while (nextLink && allMessages.length < maxResults) {
    const nextRes = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!nextRes.ok) break
    const nextData: GraphMessageList = await nextRes.json()
    allMessages = allMessages.concat(nextData.value || [])
    nextLink = nextData['@odata.nextLink']
  }

  return {
    messages: allMessages.slice(0, maxResults),
    deltaLink: data['@odata.deltaLink'],
  }
}

/**
 * Get a single message with full body.
 */
export async function getMessage(accessToken: string, messageId: string): Promise<GraphMessage> {
  const res = await fetch(
    `${GRAPH_BASE}/me/messages/${messageId}?$select=id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead,isDraft,categories,hasAttachments`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!res.ok) {
    throw new Error(`Graph getMessage failed: ${res.status}`)
  }

  return res.json()
}

/**
 * Get message metadata only (lighter than full message).
 */
export async function getMessageMetadata(accessToken: string, messageId: string): Promise<GraphMessage> {
  const res = await fetch(
    `${GRAPH_BASE}/me/messages/${messageId}?$select=id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,isDraft,categories,hasAttachments`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!res.ok) {
    throw new Error(`Graph getMessageMetadata failed: ${res.status}`)
  }

  return res.json()
}

/**
 * Send an email via Microsoft Graph.
 */
export async function sendMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  replyToMessageId?: string,
): Promise<void> {
  if (replyToMessageId) {
    // Reply to existing message
    const res = await fetch(`${GRAPH_BASE}/me/messages/${replyToMessageId}/reply`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          toRecipients: [{ emailAddress: { address: to } }],
          body: { contentType: 'Text', content: body },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Graph reply failed: ${res.status} ${err?.error?.message || ''}`)
    }
  } else {
    // Send new message
    const res = await fetch(`${GRAPH_BASE}/me/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Graph sendMail failed: ${res.status} ${err?.error?.message || ''}`)
    }
  }
}

/**
 * Forward a message.
 */
export async function forwardMessage(
  accessToken: string,
  messageId: string,
  to: string,
  comment?: string,
): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/me/messages/${messageId}/forward`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      comment: comment || '',
      toRecipients: [{ emailAddress: { address: to } }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Graph forward failed: ${res.status} ${err?.error?.message || ''}`)
  }
}

/**
 * Get user's mail profile (email, display name).
 */
export async function getMailProfile(accessToken: string): Promise<{
  email: string
  displayName: string
}> {
  const res = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error('Failed to get mail profile')

  const data = await res.json()
  return {
    email: data.mail || data.userPrincipalName,
    displayName: data.displayName,
  }
}

/**
 * Parse a Graph message into our common email format.
 */
export function parseGraphMessage(msg: GraphMessage) {
  const fromAddress = msg.from?.emailAddress?.address || ''
  const fromName = msg.from?.emailAddress?.name || null

  return {
    messageId: msg.id,
    threadId: msg.conversationId,
    subject: msg.subject || '(no subject)',
    fromAddress,
    fromName,
    toAddresses: (msg.toRecipients || []).map(r => r.emailAddress.address),
    receivedAt: msg.receivedDateTime,
    snippet: msg.bodyPreview || '',
    labels: msg.categories || [],
    isRead: msg.isRead,
  }
}

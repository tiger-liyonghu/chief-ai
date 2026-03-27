import { google } from 'googleapis'
import { getOAuth2Client } from './auth'

function getGmailClient(accessToken: string) {
  const auth = getOAuth2Client()
  auth.setCredentials({ access_token: accessToken })
  return google.gmail({ version: 'v1', auth })
}

export async function listMessages(accessToken: string, maxResults = 50, pageToken?: string, query = 'in:inbox') {
  const gmail = getGmailClient(accessToken)
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    pageToken,
    q: query,
  })
  return res.data
}

export async function getMessage(accessToken: string, messageId: string) {
  const gmail = getGmailClient(accessToken)
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })
  return res.data
}

export async function getMessageMetadata(accessToken: string, messageId: string) {
  const gmail = getGmailClient(accessToken)
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Subject', 'Date'],
  })
  return res.data
}

export async function listHistory(accessToken: string, startHistoryId: string) {
  const gmail = getGmailClient(accessToken)
  const res = await gmail.users.history.list({
    userId: 'me',
    startHistoryId,
    historyTypes: ['messageAdded'],
  })
  return res.data
}

export async function getProfile(accessToken: string) {
  const gmail = getGmailClient(accessToken)
  const res = await gmail.users.getProfile({ userId: 'me' })
  return res.data
}

export async function sendMessage(accessToken: string, raw: string) {
  const gmail = getGmailClient(accessToken)
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  })
  return res.data
}

export function parseEmailHeaders(headers: { name?: string; value?: string }[] = []) {
  const get = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
  return {
    from: get('From'),
    to: get('To'),
    subject: get('Subject'),
    date: get('Date'),
  }
}

export function parseEmailBody(payload: any): string {
  if (!payload) return ''

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  }

  if (payload.parts) {
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain')
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, 'base64url').toString('utf-8')
    }
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    for (const part of payload.parts) {
      const nested = parseEmailBody(part)
      if (nested) return nested
    }
  }

  return ''
}

function encodeSubject(subject: string): string {
  // Check if subject contains non-ASCII characters
  if (/[^\x00-\x7F]/.test(subject)) {
    // RFC 2047 Base64 encoding for UTF-8
    const encoded = Buffer.from(subject, 'utf-8').toString('base64')
    return `=?UTF-8?B?${encoded}?=`
  }
  return subject
}

export function createForwardEmail(
  to: string,
  originalSubject: string,
  originalFrom: string,
  originalDate: string,
  originalBody: string,
  senderName?: string,
  note?: string,
): string {
  const fwdSubject = `Fwd: ${originalSubject}`
  const separator = '---------- Forwarded message ----------'
  const fwdBlock = [
    separator,
    `From: ${originalFrom}`,
    `Date: ${originalDate}`,
    `Subject: ${originalSubject}`,
    '',
    originalBody,
  ].join('\n')

  const bodyText = note ? `${note}\n\n${fwdBlock}` : fwdBlock

  const headers = [
    `To: ${to}`,
    ...(senderName ? [`From: ${senderName}`] : []),
    `Subject: ${encodeSubject(fwdSubject)}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    'MIME-Version: 1.0',
  ]

  const bodyBase64 = Buffer.from(bodyText, 'utf-8').toString('base64')
  const email = headers.join('\r\n') + '\r\n\r\n' + bodyBase64
  return Buffer.from(email).toString('base64url')
}

export function createRawEmail(to: string, subject: string, body: string, threadId?: string, messageId?: string) {
  const headers = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    'MIME-Version: 1.0',
  ]
  if (messageId) {
    headers.push(`In-Reply-To: ${messageId}`)
    headers.push(`References: ${messageId}`)
  }
  const bodyBase64 = Buffer.from(body, 'utf-8').toString('base64')
  const email = headers.join('\r\n') + '\r\n\r\n' + bodyBase64
  return Buffer.from(email).toString('base64url')
}

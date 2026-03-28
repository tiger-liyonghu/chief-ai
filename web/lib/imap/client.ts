/**
 * IMAP/SMTP client for generic email providers (163, QQ, enterprise mail, etc.)
 *
 * Uses ImapFlow for IMAP connections and Nodemailer for SMTP.
 * Designed for short-lived serverless connections: connect, fetch, disconnect.
 */

import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

export interface ImapConfig {
  host: string
  port: number
  email: string
  password: string  // authorization code for 163/QQ
}

export interface SmtpConfig {
  host: string
  port: number
  email: string
  password: string
}

export interface ImapMessageHeader {
  uid: number
  messageId: string
  subject: string
  from: { name: string | null; address: string }
  to: { name: string | null; address: string }[]
  date: string
  snippet: string
  flags: string[]
}

/**
 * Known IMAP/SMTP provider presets.
 * Users can also supply custom host/port.
 */
export const IMAP_PRESETS: Record<string, { imap: { host: string; port: number }; smtp: { host: string; port: number }; label: string }> = {
  '163': {
    imap: { host: 'imap.163.com', port: 993 },
    smtp: { host: 'smtp.163.com', port: 465 },
    label: '163 Mail',
  },
  'qq': {
    imap: { host: 'imap.qq.com', port: 993 },
    smtp: { host: 'smtp.qq.com', port: 465 },
    label: 'QQ Mail',
  },
  '126': {
    imap: { host: 'imap.126.com', port: 993 },
    smtp: { host: 'smtp.126.com', port: 465 },
    label: '126 Mail',
  },
  'yeah': {
    imap: { host: 'imap.yeah.net', port: 993 },
    smtp: { host: 'smtp.yeah.net', port: 465 },
    label: 'Yeah.net',
  },
  'custom': {
    imap: { host: '', port: 993 },
    smtp: { host: '', port: 465 },
    label: 'Custom IMAP',
  },
}

/**
 * Auto-detect provider preset from email domain.
 */
export function detectPreset(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return 'custom'
  if (domain === '163.com') return '163'
  if (domain === 'qq.com') return 'qq'
  if (domain === '126.com') return '126'
  if (domain === 'yeah.net') return 'yeah'
  return 'custom'
}

/**
 * Verify IMAP credentials by attempting a login.
 * Returns true on success, throws on failure.
 */
export async function verifyImapConnection(config: ImapConfig): Promise<boolean> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: {
      user: config.email,
      pass: config.password,
    },
    logger: false,
  })

  try {
    await client.connect()
    await client.logout()
    return true
  } catch (err: any) {
    // Clean up on error
    try { await client.close() } catch { /* ignore */ }
    throw new Error(`IMAP connection failed: ${err.message}`)
  }
}

/**
 * List recent messages from INBOX via IMAP.
 * Fetches headers only (no body) for efficiency.
 *
 * @param config - IMAP server config with credentials
 * @param limit - Max messages to fetch (default 50)
 * @param sinceUid - Only fetch messages with UID > sinceUid (incremental sync)
 * @returns Array of message headers, newest first
 */
export async function listImapMessages(
  config: ImapConfig,
  limit: number = 50,
  sinceUid?: number,
): Promise<{ messages: ImapMessageHeader[]; uidValidity: number; lastUid: number }> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: {
      user: config.email,
      pass: config.password,
    },
    logger: false,
  })

  const messages: ImapMessageHeader[] = []
  let uidValidity = 0
  let lastUid = 0

  try {
    await client.connect()

    const mailbox = await client.mailboxOpen('INBOX')
    uidValidity = Number(mailbox.uidValidity) || 0

    // Determine UID range to fetch
    let range: string
    if (sinceUid && sinceUid > 0) {
      range = `${sinceUid + 1}:*`
    } else {
      // Fetch most recent N messages by sequence number
      const total = mailbox.exists || 0
      if (total === 0) {
        await client.logout()
        return { messages: [], uidValidity, lastUid: 0 }
      }
      const start = Math.max(1, total - limit + 1)
      range = `${start}:*`
    }

    // Fetch with envelope data
    const fetchOptions = sinceUid
      ? { uid: true, envelope: true, flags: true, bodyStructure: true, source: false }
      : { envelope: true, flags: true, bodyStructure: true, source: false }

    const fetchMethod = sinceUid ? 'fetch' : 'fetch'

    for await (const msg of client.fetch(
      sinceUid ? { uid: range } : range,
      { envelope: true, flags: true },
    )) {
      const env = msg.envelope
      if (!env) continue

      const uid = msg.uid
      if (uid > lastUid) lastUid = uid

      const fromAddr = env.from?.[0]
      const toAddrs = (env.to || []).map((a: any) => ({
        name: a.name || null,
        address: a.address || '',
      }))

      messages.push({
        uid,
        messageId: env.messageId || `imap-${uid}`,
        subject: env.subject || '(No Subject)',
        from: {
          name: fromAddr?.name || null,
          address: fromAddr?.address || '',
        },
        to: toAddrs,
        date: env.date ? new Date(env.date).toISOString() : new Date().toISOString(),
        snippet: '', // IMAP doesn't provide snippets in envelope; we leave it empty
        flags: Array.from(msg.flags || []),
      })
    }

    await client.logout()
  } catch (err: any) {
    try { await client.close() } catch { /* ignore */ }
    throw new Error(`IMAP fetch failed: ${err.message}`)
  }

  // Sort newest first
  messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return { messages, uidValidity, lastUid }
}

/**
 * Fetch the Sent mailbox messages.
 * 163 uses a folder named "&XfJT0ZAB-" (ISTRSTRSTR) or "Sent Messages" or "SENT".
 */
export async function listImapSentMessages(
  config: ImapConfig,
  limit: number = 30,
): Promise<ImapMessageHeader[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: {
      user: config.email,
      pass: config.password,
    },
    logger: false,
  })

  const messages: ImapMessageHeader[] = []

  try {
    await client.connect()

    // Try common sent folder names
    const sentNames = ['Sent Messages', 'Sent', 'SENT', '&XfJT0ZAB-', 'Sent Items']
    let opened = false

    for (const name of sentNames) {
      try {
        await client.mailboxOpen(name)
        opened = true
        break
      } catch {
        // Try next name
      }
    }

    if (!opened) {
      // List all mailboxes and find sent
      const mailboxes = await client.list()
      const sentBox = mailboxes.find(
        (m: any) => m.specialUse === '\\Sent' || m.name.toLowerCase().includes('sent'),
      )
      if (sentBox) {
        await client.mailboxOpen(sentBox.path)
        opened = true
      }
    }

    if (!opened) {
      await client.logout()
      return []
    }

    const mailbox = client.mailbox
    const total = (mailbox as any)?.exists || 0
    if (total === 0) {
      await client.logout()
      return []
    }

    const start = Math.max(1, total - limit + 1)
    for await (const msg of client.fetch(`${start}:*`, { envelope: true, flags: true })) {
      const env = msg.envelope
      if (!env) continue

      const fromAddr = env.from?.[0]
      const toAddrs = (env.to || []).map((a: any) => ({
        name: a.name || null,
        address: a.address || '',
      }))

      messages.push({
        uid: msg.uid,
        messageId: env.messageId || `imap-sent-${msg.uid}`,
        subject: env.subject || '(No Subject)',
        from: {
          name: fromAddr?.name || null,
          address: fromAddr?.address || '',
        },
        to: toAddrs,
        date: env.date ? new Date(env.date).toISOString() : new Date().toISOString(),
        snippet: '',
        flags: Array.from(msg.flags || []),
      })
    }

    await client.logout()
  } catch (err: any) {
    try { await client.close() } catch { /* ignore */ }
    // Sent folder fetch is non-critical; just return empty
    console.warn(`IMAP Sent folder fetch failed: ${err.message}`)
    return []
  }

  messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return messages
}

/**
 * Send an email via SMTP.
 */
export async function sendSmtpMessage(
  config: SmtpConfig,
  to: string,
  subject: string,
  body: string,
  options?: { html?: string; cc?: string; replyTo?: string },
): Promise<{ messageId: string }> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: true, // SSL for port 465
    auth: {
      user: config.email,
      pass: config.password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })

  const info = await transporter.sendMail({
    from: config.email,
    to,
    subject,
    text: body,
    html: options?.html,
    cc: options?.cc,
    replyTo: options?.replyTo,
  })

  return { messageId: info.messageId }
}

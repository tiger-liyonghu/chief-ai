/**
 * Backfill body_text for IMAP emails that have NULL body_text.
 *
 * Usage: npx tsx scripts/backfill-body-text.ts
 *
 * Requires .env.local with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TOKEN_ENCRYPTION_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'
import crypto from 'crypto'

// Load env
import { readFileSync } from 'fs'
const envContent = readFileSync('.env.local', 'utf8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function decrypt(encrypted: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex')
  const buf = Buffer.from(encrypted, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8')
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const libmime = require('libmime') as { decodeWords: (str: string) => string }

function decodeHeader(value: string | null | undefined): string {
  if (!value) return ''
  try { return libmime.decodeWords(value) } catch { return value }
}

async function fetchBody(client: ImapFlow, uid: number): Promise<string> {
  const message = await client.fetchOne(String(uid), { source: true }, { uid: true })
  if (!message || !(message as any).source) return ''

  const raw = ((message as any).source as Buffer).toString('binary')

  function extractPartInfo(headerBlock: string): { charset: string; encoding: string } {
    const charsetMatch = headerBlock.match(/charset\s*=\s*"?([^";\s]+)"?/i)
    const encodingMatch = headerBlock.match(/Content-Transfer-Encoding:\s*(\S+)/i)
    return {
      charset: (charsetMatch?.[1] || 'utf-8').toLowerCase(),
      encoding: (encodingMatch?.[1] || '7bit').toLowerCase(),
    }
  }

  function decodePart(body: string, charset: string, encoding: string): string {
    let buf: Buffer
    if (encoding === 'base64') {
      buf = Buffer.from(body.replace(/\r?\n/g, ''), 'base64')
    } else if (encoding === 'quoted-printable') {
      const cleaned = body.replace(/=\r?\n/g, '')
      const bytes = cleaned.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      buf = Buffer.from(bytes, 'binary')
    } else {
      buf = Buffer.from(body, 'binary')
    }
    try {
      const decoder = new TextDecoder(charset === 'gb2312' ? 'gbk' : charset)
      return decoder.decode(buf)
    } catch {
      return buf.toString('utf-8')
    }
  }

  const textMatch = raw.match(/Content-Type:\s*text\/plain[^\r\n]*[\s\S]*?(?:Content-Transfer-Encoding:\s*\S+[^\r\n]*\r?\n)?\r?\n([\s\S]*?)(?:\r\n--|\r\n\.\r\n|$)/i)
  if (textMatch) {
    const headerBlock = raw.slice(raw.lastIndexOf('Content-Type', raw.indexOf(textMatch[1])) - 200, raw.indexOf(textMatch[1]))
    const { charset, encoding } = extractPartInfo(headerBlock)
    return decodePart(textMatch[1], charset, encoding)
  }

  const htmlMatch = raw.match(/Content-Type:\s*text\/html[^\r\n]*[\s\S]*?(?:Content-Transfer-Encoding:\s*\S+[^\r\n]*\r?\n)?\r?\n([\s\S]*?)(?:\r\n--|\r\n\.\r\n|$)/i)
  if (htmlMatch) {
    const headerBlock = raw.slice(raw.lastIndexOf('Content-Type', raw.indexOf(htmlMatch[1])) - 200, raw.indexOf(htmlMatch[1]))
    const { charset, encoding } = extractPartInfo(headerBlock)
    return decodePart(htmlMatch[1], charset, encoding).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const bodyStart = raw.indexOf('\r\n\r\n')
  if (bodyStart >= 0) return raw.slice(bodyStart + 4, bodyStart + 2000)
  return ''
}

async function main() {
  // Find IMAP accounts
  const { data: accounts } = await sb.from('google_accounts')
    .select('id, user_id, google_email, access_token_encrypted, refresh_token_encrypted, provider')
    .eq('provider', 'imap')

  if (!accounts || accounts.length === 0) {
    console.log('No IMAP accounts found')
    return
  }

  for (const account of accounts) {
    console.log(`\n=== Processing ${account.google_email} ===`)

    // Decrypt credentials
    const password = decrypt(account.access_token_encrypted)
    const serverConfig = JSON.parse(decrypt(account.refresh_token_encrypted))

    // Find emails with NULL body_text
    const { data: emails } = await sb.from('emails')
      .select('id, gmail_message_id, subject')
      .eq('user_id', account.user_id)
      .eq('source_account_email', account.google_email)
      .is('body_text', null)
      .order('received_at', { ascending: false })

    if (!emails || emails.length === 0) {
      console.log('  No emails need backfill')
      continue
    }

    console.log(`  ${emails.length} emails need body_text`)

    // Connect once, fetch all bodies
    const client = new ImapFlow({
      host: serverConfig.imapHost,
      port: serverConfig.imapPort,
      secure: true,
      auth: { user: account.google_email, pass: password },
      logger: false,
    })

    try {
      await client.connect()
      await client.mailboxOpen('INBOX')

      let updated = 0
      let failed = 0

      // Batch: collect UIDs, fetch in chunks of 20
      const BATCH = 20
      for (let i = 0; i < emails.length; i += BATCH) {
        const batch = emails.slice(i, i + BATCH)
        const promises = batch.map(async (email) => {
          const uidMatch = email.gmail_message_id.match(/^imap-[a-f0-9-]{36}-(\d+)-/)
          const uid = uidMatch ? parseInt(uidMatch[1], 10) : 0
          if (uid === 0) { failed++; return }

          try {
            const body = await fetchBody(client, uid)
            if (body && body.length > 0) {
              await sb.from('emails').update({ body_text: body }).eq('id', email.id)
              updated++
            } else {
              failed++
            }
          } catch {
            failed++
          }
        })
        await Promise.allSettled(promises)
        console.log(`  Progress: ${updated}/${emails.length} updated, ${failed} failed`)
      }

      console.log(`  Done: ${updated} updated, ${failed} failed`)
      await client.logout()
    } catch (err: any) {
      console.error(`  Connection failed: ${err.message}`)
      try { await client.close() } catch { /* ignore */ }
    }
  }

  // Final stats
  const { count: total } = await sb.from('emails').select('id', { count: 'exact', head: true })
  const { count: withBody } = await sb.from('emails').select('id', { count: 'exact', head: true }).not('body_text', 'is', null)
  const { count: nullBody } = await sb.from('emails').select('id', { count: 'exact', head: true }).is('body_text', null)

  console.log(`\n=== Final Stats ===`)
  console.log(`Total: ${total} | With body: ${withBody} | NULL: ${nullBody}`)
  console.log(`Coverage: ${((withBody || 0) / (total || 1) * 100).toFixed(1)}%`)
}

main().catch(console.error)

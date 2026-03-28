/**
 * IMAP account token management.
 * Retrieves and manages encrypted IMAP credentials from google_accounts table.
 * Parallel to lib/google/tokens.ts and lib/microsoft/tokens.ts.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/google/tokens'
import type { ImapConfig } from './client'

export interface ImapAccountWithToken {
  accountId: string
  email: string
  password: string
  imapConfig: ImapConfig
  smtpConfig: { host: string; port: number; email: string; password: string }
  uidValidity: string | null
  lastUid: string | null
}

/**
 * Get all IMAP accounts for a user with decrypted credentials.
 */
export async function getImapAccountTokens(userId: string): Promise<ImapAccountWithToken[]> {
  const supabase = createAdminClient()

  const { data: accounts, error } = await supabase
    .from('google_accounts')
    .select('id, google_email, access_token_encrypted, refresh_token_encrypted, imap_uid_validity, imap_last_uid')
    .eq('user_id', userId)
    .eq('provider', 'imap')

  if (error || !accounts || accounts.length === 0) {
    return []
  }

  const results: ImapAccountWithToken[] = []

  for (const acc of accounts) {
    try {
      const password = decrypt(acc.access_token_encrypted)

      // Server config is stored encrypted in refresh_token_encrypted as JSON
      let serverConfig: { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }
      try {
        serverConfig = JSON.parse(decrypt(acc.refresh_token_encrypted))
      } catch {
        console.error(`Failed to parse server config for IMAP account ${acc.google_email}`)
        continue
      }

      results.push({
        accountId: acc.id,
        email: acc.google_email,
        password,
        imapConfig: {
          host: serverConfig.imapHost,
          port: serverConfig.imapPort,
          email: acc.google_email,
          password,
        },
        smtpConfig: {
          host: serverConfig.smtpHost,
          port: serverConfig.smtpPort,
          email: acc.google_email,
          password,
        },
        uidValidity: acc.imap_uid_validity,
        lastUid: acc.imap_last_uid,
      })
    } catch (err) {
      console.error(`Failed to decrypt IMAP credentials for ${acc.google_email}:`, err)
    }
  }

  return results
}

/**
 * Update IMAP sync state (UID validity and last UID) for incremental sync.
 */
export async function updateImapSyncState(
  accountId: string,
  uidValidity: string,
  lastUid: string,
) {
  const supabase = createAdminClient()
  await supabase.from('google_accounts').update({
    imap_uid_validity: uidValidity,
    imap_last_uid: lastUid,
    updated_at: new Date().toISOString(),
  }).eq('id', accountId)
}

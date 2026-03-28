import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshAccessToken } from './auth'

export function decrypt(encrypted: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex')
  const buf = Buffer.from(encrypted, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8')
}

export function encrypt(text: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/** Backward-compatible: get access token from the legacy google_tokens table (primary account) */
export async function getValidAccessToken(userId: string): Promise<string> {
  // Try new google_accounts table first (primary account)
  const supabase = createAdminClient()

  const { data: account } = await supabase
    .from('google_accounts')
    .select('id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .single()

  if (account) {
    return getValidAccessTokenForAccount(account.id)
  }

  // Fallback to legacy google_tokens table
  const { data: tokens, error } = await supabase
    .from('google_tokens')
    .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('user_id', userId)
    .single()

  if (error || !tokens) throw new Error('No Google tokens found for user')

  return refreshIfNeeded(
    tokens.access_token_encrypted,
    tokens.refresh_token_encrypted,
    tokens.token_expires_at,
    async (newAccessEnc, newExpiry) => {
      await supabase.from('google_tokens').update({
        access_token_encrypted: newAccessEnc,
        token_expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
    }
  )
}

/** Get a valid access token for a specific google_accounts row */
export async function getValidAccessTokenForAccount(accountId: string): Promise<string> {
  const supabase = createAdminClient()

  const { data: account, error } = await supabase
    .from('google_accounts')
    .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('id', accountId)
    .single()

  if (error || !account) throw new Error(`No Google account found: ${accountId}`)

  return refreshIfNeeded(
    account.access_token_encrypted,
    account.refresh_token_encrypted,
    account.token_expires_at,
    async (newAccessEnc, newExpiry) => {
      await supabase.from('google_accounts').update({
        access_token_encrypted: newAccessEnc,
        token_expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      }).eq('id', accountId)
    }
  )
}

export interface AccountWithToken {
  accountId: string
  googleEmail: string
  accessToken: string
  gmailHistoryId: string | null
}

/** Get valid access tokens for ALL accounts belonging to a user */
export async function getAllAccountTokens(userId: string): Promise<AccountWithToken[]> {
  const supabase = createAdminClient()

  const { data: accounts, error } = await supabase
    .from('google_accounts')
    .select('id, google_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, gmail_history_id')
    .eq('user_id', userId)
    .or('provider.eq.google,provider.is.null')
    .order('is_primary', { ascending: false })

  if (error || !accounts || accounts.length === 0) {
    // Fallback: try legacy google_tokens
    const token = await getValidAccessToken(userId)
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    const { data: tokenRow } = await supabase
      .from('google_tokens')
      .select('gmail_history_id')
      .eq('user_id', userId)
      .single()

    return [{
      accountId: 'legacy',
      googleEmail: profile?.email || 'unknown',
      accessToken: token,
      gmailHistoryId: tokenRow?.gmail_history_id || null,
    }]
  }

  const results: AccountWithToken[] = []
  for (const acc of accounts) {
    try {
      const accessToken = await refreshIfNeeded(
        acc.access_token_encrypted,
        acc.refresh_token_encrypted,
        acc.token_expires_at,
        async (newAccessEnc, newExpiry) => {
          await supabase.from('google_accounts').update({
            access_token_encrypted: newAccessEnc,
            token_expires_at: newExpiry,
            updated_at: new Date().toISOString(),
          }).eq('id', acc.id)
        }
      )
      results.push({
        accountId: acc.id,
        googleEmail: acc.google_email,
        accessToken,
        gmailHistoryId: acc.gmail_history_id,
      })
    } catch (err) {
      console.error(`Failed to get token for account ${acc.google_email}:`, err)
      // Skip this account but continue with others
    }
  }

  return results
}

/** Update gmail_history_id for a specific account */
export async function updateAccountHistoryId(accountId: string, historyId: string) {
  const supabase = createAdminClient()
  if (accountId === 'legacy') {
    // Can't update legacy — skip
    return
  }
  await supabase.from('google_accounts').update({
    gmail_history_id: historyId,
    updated_at: new Date().toISOString(),
  }).eq('id', accountId)
}

// ------ internal helper ------

async function refreshIfNeeded(
  accessTokenEnc: string,
  refreshTokenEnc: string,
  expiresAt: string,
  onRefresh: (newAccessEnc: string, newExpiry: string) => Promise<void>,
): Promise<string> {
  const expiry = new Date(expiresAt)
  const now = new Date()

  if (expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshToken = decrypt(refreshTokenEnc)
    const newCredentials = await refreshAccessToken(refreshToken)

    if (!newCredentials.access_token) throw new Error('Failed to refresh token')

    const newExpiry = new Date(newCredentials.expiry_date || Date.now() + 3600000).toISOString()
    await onRefresh(encrypt(newCredentials.access_token), newExpiry)

    return newCredentials.access_token
  }

  return decrypt(accessTokenEnc)
}

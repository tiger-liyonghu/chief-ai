/**
 * Microsoft account token management.
 * Handles encrypted storage and refresh, parallel to lib/google/tokens.ts.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt, decrypt } from '@/lib/google/tokens'
import { refreshMicrosoftToken } from './auth'

export interface MicrosoftAccountWithToken {
  accountId: string
  email: string
  accessToken: string
  deltaLink: string | null
}

/**
 * Get valid access tokens for all Microsoft accounts belonging to a user.
 */
export async function getMicrosoftAccountTokens(userId: string): Promise<MicrosoftAccountWithToken[]> {
  const supabase = createAdminClient()

  const { data: accounts, error } = await supabase
    .from('google_accounts')
    .select('id, google_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, calendar_sync_token')
    .eq('user_id', userId)
    .eq('provider', 'microsoft')

  if (error || !accounts || accounts.length === 0) {
    return []
  }

  const results: MicrosoftAccountWithToken[] = []

  for (const acc of accounts) {
    try {
      const accessToken = await refreshIfNeeded(
        acc.id,
        acc.access_token_encrypted,
        acc.refresh_token_encrypted,
        acc.token_expires_at,
      )
      results.push({
        accountId: acc.id,
        email: acc.google_email,
        accessToken,
        deltaLink: acc.calendar_sync_token, // reuse this field for delta link
      })
    } catch (err) {
      console.error(`Failed to get Microsoft token for ${acc.google_email}:`, err)
    }
  }

  return results
}

/**
 * Update the delta link for incremental sync.
 */
export async function updateMicrosoftDeltaLink(accountId: string, deltaLink: string) {
  const supabase = createAdminClient()
  await supabase.from('google_accounts').update({
    calendar_sync_token: deltaLink, // reuse field
    updated_at: new Date().toISOString(),
  }).eq('id', accountId)
}

// ─── Internal ───

async function refreshIfNeeded(
  accountId: string,
  accessTokenEnc: string,
  refreshTokenEnc: string,
  expiresAt: string,
): Promise<string> {
  const expiry = new Date(expiresAt)
  const now = new Date()

  if (expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshToken = decrypt(refreshTokenEnc)
    const newTokens = await refreshMicrosoftToken(refreshToken)

    if (!newTokens.access_token) throw new Error('Failed to refresh Microsoft token')

    const supabase = createAdminClient()
    const updates: Record<string, any> = {
      access_token_encrypted: encrypt(newTokens.access_token),
      token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Microsoft may return a new refresh token
    if (newTokens.refresh_token) {
      updates.refresh_token_encrypted = encrypt(newTokens.refresh_token)
    }

    await supabase.from('google_accounts').update(updates).eq('id', accountId)

    return newTokens.access_token
  }

  return decrypt(accessTokenEnc)
}

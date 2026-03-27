/**
 * Microsoft OAuth 2.0 authentication for Outlook/Microsoft 365.
 * Uses Microsoft Identity Platform v2.0 endpoints.
 */

const SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/Calendars.ReadWrite',
]

function getConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET')
  }
  return { clientId, clientSecret }
}

/**
 * Generate Microsoft OAuth authorization URL.
 */
export function getMicrosoftAuthUrl(options?: { state?: string; redirectPath?: string; loginHint?: string }) {
  const { clientId } = getConfig()
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}${options?.redirectPath || '/api/accounts/outlook-callback'}`

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    response_mode: 'query',
    prompt: 'consent',
    ...(options?.state ? { state: options.state } : {}),
    ...(options?.loginHint ? { login_hint: options.loginHint } : {}),
  })

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
}

/**
 * Exchange authorization code for tokens.
 */
export async function getMicrosoftTokensFromCode(
  code: string,
  redirectPath = '/api/accounts/outlook-callback',
): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  id_token?: string
}> {
  const { clientId, clientSecret } = getConfig()
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}`

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Microsoft token exchange failed: ${error.error_description || error.error}`)
  }

  return res.json()
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshMicrosoftToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
}> {
  const { clientId, clientSecret } = getConfig()

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPES.join(' '),
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Microsoft token refresh failed: ${error.error_description || error.error}`)
  }

  return res.json()
}

/**
 * Get Microsoft user profile from access token.
 */
export async function getMicrosoftProfile(accessToken: string): Promise<{
  id: string
  displayName: string
  mail: string
  userPrincipalName: string
}> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error('Failed to fetch Microsoft profile')
  }

  return res.json()
}

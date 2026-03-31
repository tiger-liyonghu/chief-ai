import { google } from 'googleapis'

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
]

export function getOAuth2Client(redirectPath = '/api/auth/callback') {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}`
  )
}

export function getAuthUrl(options?: { state?: string; redirectPath?: string; loginHint?: string }) {
  const client = getOAuth2Client(options?.redirectPath)
  const params: Record<string, any> = {
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: SCOPES,
  }
  if (options?.state) params.state = options.state
  if (options?.loginHint) params.login_hint = options.loginHint
  return client.generateAuthUrl(params)
}

export async function getTokensFromCode(code: string, redirectPath = '/api/auth/callback') {
  const client = getOAuth2Client(redirectPath)
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function refreshAccessToken(refreshToken: string) {
  const client = getOAuth2Client()
  client.setCredentials({ refresh_token: refreshToken })
  try {
    const { credentials } = await client.refreshAccessToken()
    return credentials
  } catch (err: any) {
    // Google returns 'invalid_grant' when refresh token is expired/revoked
    // (e.g. after 6 months of inactivity, password change, or user revoked access)
    const isGrantError =
      err?.message?.includes('invalid_grant') ||
      err?.response?.data?.error === 'invalid_grant'
    if (isGrantError) {
      throw new Error(
        'Google refresh token expired or revoked. User must re-authenticate. ' +
        '(Original: ' + (err.message || 'invalid_grant') + ')'
      )
    }
    throw err
  }
}

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
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: options?.state,
    login_hint: options?.loginHint,
  })
}

export async function getTokensFromCode(code: string, redirectPath = '/api/auth/callback') {
  const client = getOAuth2Client(redirectPath)
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function refreshAccessToken(refreshToken: string) {
  const client = getOAuth2Client()
  client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await client.refreshAccessToken()
  return credentials
}

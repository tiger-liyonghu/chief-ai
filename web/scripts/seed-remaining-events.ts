/**
 * Create remaining calendar events that hit rate limit
 * Run: set -a && source .env.local && set +a && npx tsx scripts/seed-remaining-events.ts
 */
import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!
const TO = 'aiat.actuaryhelp@gmail.com'
const FROM = 'sophie@actuaryhelp.com'

function decrypt(encrypted: string): string {
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex')
  const buf = Buffer.from(encrypted, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8')
}

async function getAccessToken(): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js')
  const c = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data: acc } = await c.from('google_accounts').select('refresh_token_encrypted').eq('google_email', FROM).single()
  if (!acc) throw new Error('No account')
  const refreshToken = decrypt(acc.refresh_token_encrypted)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Refresh failed')
  return data.access_token
}

async function createEvent(token: string, summary: string, start: string, end: string, desc = '', location = '') {
  const body: any = {
    summary, description: desc, location,
    start: { dateTime: start, timeZone: 'Asia/Singapore' },
    end: { dateTime: end, timeZone: 'Asia/Singapore' },
    attendees: [{ email: TO }],
  }
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) console.error('  ✗', summary, data.error.message)
  else console.log('  ✓', summary, start)
}

function d(days: number, h: number, m = 0) {
  const dt = new Date(); dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+08:00`
}

async function main() {
  const token = await getAccessToken()
  console.log('Token ready. Creating remaining events...\n')

  // Tokyo trip remaining
  await createEvent(token, '🛍️ Free Afternoon - Tokyo', d(8,14), d(8,18), "Free time. Emma asked for Pokémon plush from Pokémon Center Mega Tokyo.", "Sunshine City, Ikebukuro, Tokyo")
  await new Promise(r => setTimeout(r, 2000))
  await createEvent(token, 'Breakfast Meeting - Dai-ichi Life', d(9,8), d(9,9,30), "Discuss distribution partnership for Japan market.", "Aman Tokyo Lounge")
  await new Promise(r => setTimeout(r, 2000))
  await createEvent(token, '✈️ Fly back to Singapore - SQ637', d(9,13,30), d(9,19,30), "Tokyo → Singapore. SQ637. Land 7:30pm.", "Narita International Airport")
  await new Promise(r => setTimeout(r, 2000))

  // Week after
  await createEvent(token, '💕 太太生日 - Capella Sentosa', d(11,14), d(12,12), "Manor Suite. 包含 Spa + 烛光晚餐。Emma 在外婆家。", "Capella Singapore, 1 The Knolls, Sentosa Island")
  await new Promise(r => setTimeout(r, 2000))
  await createEvent(token, 'Leadership Strategy Session - Tokio Marine JV', d(13,10), d(13,12), "Discuss Tokio Marine joint venture terms. $2M investment decision.", "")
  await new Promise(r => setTimeout(r, 2000))
  await createEvent(token, 'Investor Update Call - Series A Investors', d(13,15), d(13,16), "Quarterly update. Q1 metrics, APAC expansion, Japan partnership.", "")
  await new Promise(r => setTimeout(r, 2000))
  await createEvent(token, 'Performance Reviews Due', d(14,9), d(14,9,30), "DEADLINE: Submit reviews for Sarah, Michael, Lisa.", "")
  await new Promise(r => setTimeout(r, 2000))
  await createEvent(token, 'Family Movie Night 🎬', d(14,19), d(14,21,30), "Emma's pick. New Pixar movie.", "GV VivoCity, 1 HarbourFront Walk")

  console.log('\n✅ Done!')
}

main().catch(console.error)

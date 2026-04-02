import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractCityFromEmail } from '@/lib/contacts/extract-city'

/**
 * POST /api/contacts/backfill-city
 *
 * One-time backfill: scan historical emails to extract city for contacts
 * that don't have one yet. Accelerates data accumulation for travel
 * contact activation ("KL has 3 clients you can visit").
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get contacts without city
  const { data: contacts } = await admin
    .from('contacts')
    .select('id, email')
    .eq('user_id', user.id)
    .is('city', null)
    .limit(200)

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ updated: 0, message: 'All contacts already have city data' })
  }

  let updated = 0

  for (const contact of contacts) {
    // Get the most recent email from this contact with body text
    const { data: emails } = await admin
      .from('emails')
      .select('body_text')
      .eq('user_id', user.id)
      .eq('from_address', contact.email.toLowerCase())
      .not('body_text', 'is', null)
      .order('received_at', { ascending: false })
      .limit(3)

    if (!emails) continue

    // Try each email until we find a city
    for (const email of emails) {
      const city = extractCityFromEmail(email.body_text)
      if (city) {
        await admin.from('contacts').update({ city }).eq('id', contact.id)
        updated++
        break
      }
    }
  }

  return NextResponse.json({
    scanned: contacts.length,
    updated,
    message: `Found city for ${updated} of ${contacts.length} contacts`,
  })
}

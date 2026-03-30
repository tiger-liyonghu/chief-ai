/**
 * Seed Runner - Insert test data into Supabase
 * Usage: npx tsx tests/seed/run-seed.ts [--persona jason|priya|thomas|all] [--clean]
 */

import { createClient } from '@supabase/supabase-js'
import { PERSONAS, generateContacts, generateEmails, generateCommitments, generateFamilyCalendar, generateTrips } from './personas'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function cleanPersona(personaId: string) {
  console.log(`  Cleaning data for ${personaId}...`)
  // Delete in order (foreign keys)
  await supabase.from('commitments').delete().eq('user_id', personaId)
  await supabase.from('family_calendar').delete().eq('user_id', personaId)
  await supabase.from('trip_timeline_events').delete().eq('user_id', personaId)
  await supabase.from('trips').delete().eq('user_id', personaId)
  await supabase.from('emails').delete().eq('user_id', personaId)
  await supabase.from('contacts').delete().eq('user_id', personaId)
  await supabase.from('insights_snapshots').delete().eq('user_id', personaId)
  console.log(`  Cleaned.`)
}

async function seedPersona(key: keyof typeof PERSONAS) {
  const persona = PERSONAS[key]
  console.log(`\nSeeding ${persona.full_name} (${persona.id})...`)

  // Clean first
  await cleanPersona(persona.id)

  // 1. Contacts
  const contacts = generateContacts(persona.id)
  const { error: cErr } = await supabase.from('contacts').insert(
    contacts.map(c => {
      const { ...rest } = c
      return rest
    })
  )
  console.log(`  Contacts: ${contacts.length} ${cErr ? 'FAIL: ' + cErr.message : 'OK'}`)

  // 2. Emails
  const emails = generateEmails(persona.id)
  const dbEmails = emails.map(e => {
    // Remove test metadata fields
    const { _test_has_commitment, _test_commitment_type, _test_commitment_title, _test_deadline, ...dbFields } = e as Record<string, unknown>
    return dbFields
  })
  const { error: eErr } = await supabase.from('emails').insert(dbEmails)
  console.log(`  Emails: ${emails.length} (${emails.filter(e => e._test_has_commitment).length} with commitments) ${eErr ? 'FAIL: ' + eErr.message : 'OK'}`)

  // 3. Commitments
  const commitments = generateCommitments(persona.id)
  const { error: cmErr } = await supabase.from('commitments').insert(
    commitments.map(c => {
      const { ...rest } = c
      return rest
    })
  )
  console.log(`  Commitments: ${commitments.length} ${cmErr ? 'FAIL: ' + cmErr.message : 'OK'}`)

  // 4. Family Calendar
  const familyEvents = generateFamilyCalendar(persona.id)
  const { error: fErr } = await supabase.from('family_calendar').insert(familyEvents)
  console.log(`  Family events: ${familyEvents.length} ${fErr ? 'FAIL: ' + fErr.message : 'OK'}`)

  // 5. Trips
  const trips = generateTrips(persona.id)
  const { error: tErr } = await supabase.from('trips').insert(trips)
  console.log(`  Trips: ${trips.length} ${tErr ? 'FAIL: ' + tErr.message : 'OK'}`)

  console.log(`  Done: ${persona.full_name}`)
}

async function main() {
  const args = process.argv.slice(2)
  const personaArg = args.find(a => !a.startsWith('--'))
  const clean = args.includes('--clean')

  console.log('Chief Test Data Seeder')
  console.log('=====================')

  if (clean) {
    console.log('Clean mode: removing all test data')
    for (const key of Object.keys(PERSONAS)) {
      await cleanPersona(PERSONAS[key as keyof typeof PERSONAS].id)
    }
    console.log('\nAll test data cleaned.')
    return
  }

  const targets = personaArg && personaArg !== 'all'
    ? [personaArg as keyof typeof PERSONAS]
    : Object.keys(PERSONAS) as (keyof typeof PERSONAS)[]

  for (const key of targets) {
    if (!PERSONAS[key]) {
      console.error(`Unknown persona: ${key}`)
      continue
    }
    await seedPersona(key)
  }

  console.log('\nSeed complete.')

  // Summary
  for (const key of targets) {
    const p = PERSONAS[key]
    const { count: commitCount } = await supabase.from('commitments').select('*', { count: 'exact', head: true }).eq('user_id', p.id)
    const { count: contactCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', p.id)
    const { count: emailCount } = await supabase.from('emails').select('*', { count: 'exact', head: true }).eq('user_id', p.id)
    const { count: familyCount } = await supabase.from('family_calendar').select('*', { count: 'exact', head: true }).eq('user_id', p.id)
    console.log(`  ${p.full_name}: ${emailCount} emails, ${commitCount} commitments, ${contactCount} contacts, ${familyCount} family events`)
  }
}

main().catch(console.error)

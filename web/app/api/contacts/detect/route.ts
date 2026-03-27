import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import {
  CONTACT_DETECTION_SYSTEM,
  buildContactDetectionPrompt,
  ContactInput,
  ContactClassification,
} from '@/lib/ai/prompts/contact-detection'

const AI_BATCH_SIZE = 20

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Step 1: Aggregate emails by from_address
  const { data: emailAggregates, error: aggErr } = await admin
    .from('emails')
    .select('from_address, from_name, subject, received_at')
    .eq('user_id', user.id)
    .order('received_at', { ascending: false })

  if (aggErr) {
    return NextResponse.json({ error: aggErr.message }, { status: 500 })
  }

  if (!emailAggregates || emailAggregates.length === 0) {
    return NextResponse.json({ contacts_processed: 0, new_contacts: 0 })
  }

  // Aggregate by email address
  const contactMap = new Map<string, {
    email: string
    name: string | null
    subjects: string[]
    count: number
    latest: string
  }>()

  for (const row of emailAggregates) {
    const email = row.from_address.toLowerCase().trim()
    const existing = contactMap.get(email)
    if (existing) {
      existing.count++
      if (row.subject && existing.subjects.length < 5) {
        existing.subjects.push(row.subject)
      }
      if (!existing.name && row.from_name) {
        existing.name = row.from_name
      }
    } else {
      contactMap.set(email, {
        email,
        name: row.from_name || null,
        subjects: row.subject ? [row.subject] : [],
        count: 1,
        latest: row.received_at,
      })
    }
  }

  // Step 2: Upsert new contacts that don't exist yet
  const allContacts = Array.from(contactMap.values())
  let newContacts = 0

  for (const c of allContacts) {
    const { data: existing } = await admin
      .from('contacts')
      .select('id, auto_detected')
      .eq('user_id', user.id)
      .eq('email', c.email)
      .single()

    if (!existing) {
      await admin.from('contacts').insert({
        user_id: user.id,
        email: c.email,
        name: c.name,
        email_count: c.count,
        last_contact_at: c.latest,
      })
      newContacts++
    } else {
      // Update counts for existing contacts
      await admin
        .from('contacts')
        .update({
          email_count: c.count,
          last_contact_at: c.latest,
          name: c.name || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    }
  }

  // Step 3: Get contacts that are auto_detected = true (not manually overridden)
  const { data: autoContacts, error: autoErr } = await admin
    .from('contacts')
    .select('id, email, name, email_count, last_contact_at')
    .eq('user_id', user.id)
    .eq('auto_detected', true)
    .order('email_count', { ascending: false })

  if (autoErr || !autoContacts || autoContacts.length === 0) {
    return NextResponse.json({ contacts_processed: 0, new_contacts: newContacts })
  }

  // Get user's own email addresses for context
  const { data: accounts } = await admin
    .from('google_accounts')
    .select('google_email')
    .eq('user_id', user.id)

  const userEmails = (accounts || []).map(a => a.google_email)
  if (userEmails.length === 0) {
    // Fallback to profile email
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()
    if (profile?.email) userEmails.push(profile.email)
  }

  // Step 4: Process in batches of AI_BATCH_SIZE
  let contactsProcessed = 0

  for (let i = 0; i < autoContacts.length; i += AI_BATCH_SIZE) {
    const batch = autoContacts.slice(i, i + AI_BATCH_SIZE)

    const contactInputs: ContactInput[] = batch.map(c => {
      const agg = contactMap.get(c.email.toLowerCase())
      return {
        email: c.email,
        name: c.name,
        subjects: agg?.subjects || [],
        email_count: c.email_count || 0,
        latest_date: c.last_contact_at || '',
      }
    })

    try {
      const { client, model } = await createUserAIClient(user.id)
      const aiResponse = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: CONTACT_DETECTION_SYSTEM },
          { role: 'user', content: buildContactDetectionPrompt(contactInputs, userEmails) },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      })

      const content = aiResponse.choices[0]?.message?.content
      if (!content) continue

      let classifications: ContactClassification[]
      try {
        const parsed = JSON.parse(content)
        // Handle both array and {contacts: [...]} formats
        classifications = Array.isArray(parsed) ? parsed : (parsed.contacts || parsed.results || [])
      } catch {
        console.error('Failed to parse contact classification:', content.slice(0, 200))
        continue
      }

      // Step 5: Update contacts with AI classifications
      for (const cls of classifications) {
        if (!cls.email) continue

        const contact = batch.find(c => c.email.toLowerCase() === cls.email.toLowerCase())
        if (!contact) continue

        const updates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        }

        if (cls.relationship) updates.relationship = cls.relationship
        if (cls.importance) updates.importance = cls.importance
        if (cls.company) updates.company = cls.company
        if (cls.role) updates.role = cls.role

        await admin
          .from('contacts')
          .update(updates)
          .eq('id', contact.id)

        contactsProcessed++
      }
    } catch (err) {
      console.error('AI contact classification failed for batch:', err)
      // Continue with next batch
    }
  }

  return NextResponse.json({
    contacts_processed: contactsProcessed,
    new_contacts: newContacts,
  })
}

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import {
  REPLY_DRAFT_SYSTEM,
  REPLY_DRAFT_USER,
  type GhostwriterContext,
} from '@/lib/ai/prompts/reply-draft'
import { resolveContext, contextToPrompt } from '@/lib/ontology/resolve-context'

/**
 * Gather Ghostwriter context for a contact in parallel.
 * All queries are best-effort — a failure in any single query
 * does not block the draft from being generated.
 */
async function gatherGhostwriterContext(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  contactEmail: string,
): Promise<GhostwriterContext> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [
    contactResult,
    emailsResult,
    whatsAppResult,
    followUpsResult,
    meetingsResult,
    profileResult,
  ] = await Promise.all([
    // 1. Contact profile
    adminClient
      .from('contacts')
      .select('name, email, company, role, relationship, importance, notes')
      .eq('user_id', userId)
      .eq('email', contactEmail)
      .maybeSingle(),

    // 2. Recent emails in threads with this contact (last 30 days, limit 5)
    adminClient
      .from('emails')
      .select('subject, from_address, from_name, snippet, received_at')
      .eq('user_id', userId)
      .or(`from_address.eq.${contactEmail},to_addresses.cs.{${contactEmail}}`)
      .gte('received_at', thirtyDaysAgo.toISOString())
      .order('received_at', { ascending: false })
      .limit(5),

    // 3. Recent WhatsApp messages — match by contact name/number
    //    We search by the contact email's associated name in the contacts table,
    //    but we'll handle this after the contact query. For now, fetch recent
    //    messages and filter in JS if needed. Using from_name overlap approach.
    adminClient
      .from('whatsapp_messages')
      .select('body, direction, from_name, received_at')
      .eq('user_id', userId)
      .gte('received_at', thirtyDaysAgo.toISOString())
      .order('received_at', { ascending: false })
      .limit(50), // fetch more, filter client-side by contact name

    // 4. Active follow-ups with this contact
    adminClient
      .from('follow_ups')
      .select('type, subject, commitment_text, due_date, status')
      .eq('user_id', userId)
      .eq('contact_email', contactEmail)
      .eq('status', 'active')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5),

    // 5. Upcoming calendar events involving this contact (next 7 days)
    adminClient
      .from('calendar_events')
      .select('title, start_time, end_time, location, attendees')
      .eq('user_id', userId)
      .gte('start_time', now.toISOString())
      .lte('start_time', sevenDaysFromNow.toISOString())
      .order('start_time', { ascending: true })
      .limit(20), // fetch more, filter by attendee email

    // 6. User profile for writing style notes
    adminClient
      .from('profiles')
      .select('writing_style_notes')
      .eq('id', userId)
      .single(),
  ])

  // --- Post-process WhatsApp: filter by contact name ---
  const contactName = contactResult.data?.name?.toLowerCase() || ''
  const filteredWhatsApp = contactName
    ? (whatsAppResult.data || [])
        .filter(
          (m) =>
            m.from_name?.toLowerCase().includes(contactName) ||
            contactName.includes(m.from_name?.toLowerCase() || '___'),
        )
        .slice(0, 5)
    : []

  // --- Post-process calendar: filter events whose attendees include contactEmail ---
  const filteredMeetings = (meetingsResult.data || [])
    .filter((evt) => {
      const attendees = evt.attendees as Array<{ email?: string }> | null
      if (!attendees || !Array.isArray(attendees)) return false
      return attendees.some(
        (a) => a.email?.toLowerCase() === contactEmail.toLowerCase(),
      )
    })
    .slice(0, 3)
    // Strip attendees from the output — prompt doesn't need it
    .map(({ attendees: _, ...rest }) => rest)

  return {
    contact: contactResult.data || null,
    recentEmails: emailsResult.data || [],
    recentWhatsApp: filteredWhatsApp,
    activeFollowUps: followUpsResult.data || [],
    upcomingMeetings: filteredMeetings,
    writingStyleNotes: profileResult.data?.writing_style_notes || null,
  }
}

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    })
  }

  const { thread, tone, from, subject, instructions } = await request.json()

  // Extract contact email from "from" field — handle "Name <email>" format
  const emailMatch = from?.match(/<([^>]+)>/) || [null, from]
  const contactEmail = (emailMatch[1] || from || '').trim().toLowerCase()

  // Gather Ghostwriter context, ontology context, and AI client in parallel
  const admin = createAdminClient()
  const [ghostwriterContext, ontologyContext, aiClient] = await Promise.all([
    contactEmail
      ? gatherGhostwriterContext(admin, user.id, contactEmail).catch(
          (): GhostwriterContext => ({
            contact: null,
            recentEmails: [],
            recentWhatsApp: [],
            activeFollowUps: [],
            upcomingMeetings: [],
            writingStyleNotes: null,
          }),
        )
      : Promise.resolve(null),
    // Resolve ontology graph context for this contact
    contactEmail
      ? (async () => {
          try {
            const { data: contact } = await admin
              .from('contacts')
              .select('id')
              .eq('user_id', user.id)
              .eq('email', contactEmail)
              .maybeSingle()
            if (!contact) return ''
            const bundle = await resolveContext(admin, user.id, contact.id, {
              entityType: 'person',
              maxHops: 1,
              hydrateEntities: true,
            })
            return contextToPrompt(bundle, 1)
          } catch {
            return ''
          }
        })()
      : Promise.resolve(''),
    createUserAIClient(user.id),
  ])

  const { client, model } = aiClient
  const systemPrompt = ontologyContext
    ? `${REPLY_DRAFT_SYSTEM}\n\n${ontologyContext}`
    : REPLY_DRAFT_SYSTEM
  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: REPLY_DRAFT_USER({
          thread: `From: ${from}\nSubject: ${subject}\n\n${thread}`,
          tone: tone || 'friendly',
          instructions,
          ghostwriterContext: ghostwriterContext || undefined,
        }),
      },
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 1000,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ''
        if (text) {
          controller.enqueue(encoder.encode(text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}

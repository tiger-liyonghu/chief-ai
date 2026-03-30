import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * Prep Agent — Vercel Cron calls this every 15 minutes.
 * Checks for meetings starting in the next 30 minutes,
 * generates a pre-meeting briefing, and stores it for the user.
 *
 * Cron config in vercel.json: every 15 minutes
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const in30min = new Date(now.getTime() + 30 * 60 * 1000)
  const in15min = new Date(now.getTime() + 15 * 60 * 1000)

  // Find events starting in 15-30 minutes that don't have a prep briefing yet
  const { data: upcomingEvents, error } = await admin
    .from('calendar_events')
    .select('id, user_id, title, description, start_time, end_time, attendees, location, meeting_link, source_account_email')
    .gte('start_time', in15min.toISOString())
    .lte('start_time', in30min.toISOString())
    .eq('prep_generated', false)

  if (error || !upcomingEvents || upcomingEvents.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processed = 0

  for (const event of upcomingEvents) {
    try {
      // Parse attendees
      const attendees: { email: string; name?: string }[] =
        typeof event.attendees === 'string'
          ? JSON.parse(event.attendees)
          : event.attendees ?? []

      const attendeeEmails = attendees
        .map(a => a.email?.toLowerCase())
        .filter(Boolean) as string[]

      // Gather context in parallel
      const [emailsRes, followUpsRes, contactsRes, waRes] = await Promise.all([
        // Recent emails with attendees
        attendeeEmails.length > 0
          ? admin
              .from('emails')
              .select('from_address, from_name, subject, snippet, received_at')
              .eq('user_id', event.user_id)
              .in('from_address', attendeeEmails)
              .order('received_at', { ascending: false })
              .limit(attendeeEmails.length * 3)
          : Promise.resolve({ data: [] }),

        // Active commitments with attendees
        attendeeEmails.length > 0
          ? admin
              .from('commitments')
              .select('contact_email, contact_name, title, type, deadline')
              .eq('user_id', event.user_id)
              .in('status', ['pending', 'in_progress', 'overdue'])
              .in('contact_email', attendeeEmails)
          : Promise.resolve({ data: [] }),

        // Contact profiles
        attendeeEmails.length > 0
          ? admin
              .from('contacts')
              .select('email, name, company, role, relationship, importance')
              .eq('user_id', event.user_id)
              .in('email', attendeeEmails)
          : Promise.resolve({ data: [] }),

        // Recent WhatsApp (last 48h)
        admin
          .from('whatsapp_messages')
          .select('from_name, from_number, body, direction, received_at')
          .eq('user_id', event.user_id)
          .gte('received_at', new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())
          .order('received_at', { ascending: false })
          .limit(20),
      ])

      // Build context for AI
      const contextParts: string[] = []

      contextParts.push(`Meeting: "${event.title}"`)
      contextParts.push(`Time: ${new Date(event.start_time).toLocaleString()}`)
      if (event.location) contextParts.push(`Location: ${event.location}`)
      if (event.description) contextParts.push(`Description: ${event.description}`)

      // Attendee profiles
      if (attendees.length > 0) {
        contextParts.push('\n--- Attendees ---')
        for (const a of attendees) {
          const contact = (contactsRes.data || []).find(
            (c: any) => c.email?.toLowerCase() === a.email?.toLowerCase()
          )
          if (contact) {
            contextParts.push(`- ${contact.name || a.email} (${contact.role || ''} @ ${contact.company || ''}, ${contact.relationship || ''}, ${contact.importance || 'normal'})`)
          } else {
            contextParts.push(`- ${a.name || a.email}`)
          }
        }
      }

      // Recent emails
      if ((emailsRes.data || []).length > 0) {
        contextParts.push('\n--- Recent Email Threads ---')
        for (const e of (emailsRes.data || []).slice(0, 8)) {
          contextParts.push(`- ${(e as any).from_name || (e as any).from_address}: "${(e as any).subject}" (${new Date((e as any).received_at).toLocaleDateString()})`)
        }
      }

      // Commitments
      if ((followUpsRes.data || []).length > 0) {
        contextParts.push('\n--- Open Commitments ---')
        for (const f of followUpsRes.data || []) {
          const label = (f as any).type === 'i_promised' ? 'YOU PROMISED' : 'WAITING ON THEM'
          contextParts.push(`- [${label}] ${(f as any).contact_name || (f as any).contact_email}: "${(f as any).title}" (due: ${(f as any).deadline || 'no date'})`)
        }
      }

      // WhatsApp context (match by name)
      const attendeeNames = new Set(attendees.map(a => (a.name || '').toLowerCase()).filter(Boolean))
      const relevantWa = (waRes.data || []).filter((m: any) =>
        attendeeNames.has((m.from_name || '').toLowerCase())
      )
      if (relevantWa.length > 0) {
        contextParts.push('\n--- Recent WhatsApp ---')
        for (const m of relevantWa.slice(0, 5)) {
          contextParts.push(`- ${(m as any).from_name}: "${((m as any).body || '').slice(0, 100)}"`)
        }
      }

      // Generate AI briefing
      const { client, model } = await createUserAIClient(event.user_id)

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are Prep, an AI meeting preparation agent. Generate a concise pre-meeting briefing (4-6 sentences).

Structure:
1. WHO: Key attendees and their relationship to the user
2. CONTEXT: What's been discussed recently (email/WhatsApp)
3. WATCH OUT: Open commitments, overdue items, or sensitive topics
4. SUGGESTED TALKING POINTS: 2-3 specific points to raise

Rules:
- Be specific: use names, dates, subjects
- Flag any overdue commitments prominently
- Detect language from meeting title/context and respond in same language
- Be actionable, not descriptive`,
          },
          { role: 'user', content: contextParts.join('\n') },
        ],
        temperature: 0.3,
        max_tokens: 400,
      })

      const briefing = completion.choices[0]?.message?.content?.trim() || ''

      if (briefing) {
        // Store the prep briefing
        await admin.from('meeting_briefs').upsert({
          user_id: event.user_id,
          event_id: event.id,
          briefing,
          generated_at: new Date().toISOString(),
          context_snapshot: {
            attendee_count: attendees.length,
            emails_referenced: (emailsRes.data || []).length,
            followups_referenced: (followUpsRes.data || []).length,
            wa_referenced: relevantWa.length,
          },
        }, { onConflict: 'user_id,event_id' })

        // Mark event as prepped
        await admin.from('calendar_events').update({
          prep_generated: true,
        }).eq('id', event.id)

        processed++
      }
    } catch (err) {
      console.error(`Prep Agent failed for event ${event.id}:`, err)
    }
  }

  return NextResponse.json({ processed, total_events: upcomingEvents.length })
}

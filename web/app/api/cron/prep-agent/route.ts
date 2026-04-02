import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { getContextBundle } from '@/lib/context-engine'

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

      // Gather context via unified Context Engine (per attendee)
      const attendeeBundles = await Promise.all(
        attendeeEmails.slice(0, 5).map(email =>
          getContextBundle(event.user_id, {
            contactEmail: email,
            mode: 'meeting_prep',
            depth: 'deep',
          })
        )
      )

      // Build context for AI
      const contextParts: string[] = []

      contextParts.push(`Meeting: "${event.title}"`)
      contextParts.push(`Time: ${new Date(event.start_time).toLocaleString()}`)
      if (event.location) contextParts.push(`Location: ${event.location}`)
      if (event.description) contextParts.push(`Description: ${event.description}`)

      // Attendee profiles + timelines from Context Engine
      if (attendeeBundles.length > 0) {
        contextParts.push('\n--- Attendees ---')
        for (const bundle of attendeeBundles) {
          const c = bundle.contact
          if (c) {
            contextParts.push(`- ${c.name} (${c.role || ''} @ ${c.company || ''}, ${c.relationship || ''}, ${c.importance || 'normal'}, temp=${c.temperature}/100)`)

            // Open commitments from timeline
            if (c.activeCommitments.iPromised > 0 || c.activeCommitments.waitingOnThem > 0) {
              contextParts.push(`  Commitments: ${c.activeCommitments.iPromised} you promised, ${c.activeCommitments.waitingOnThem} waiting on them`)
            }
          }

          // Timeline events (recent interactions)
          if (bundle.timeline?.events.length) {
            const recent = bundle.timeline.events.slice(-5)
            for (const evt of recent) {
              const dateStr = evt.timestamp.toLocaleDateString()
              contextParts.push(`  ${evt.type}: "${evt.title}" (${dateStr})`)
            }
          }
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

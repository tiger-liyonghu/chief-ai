// ============================================================
// Ghostwriter Agent — full-context reply drafting
// ============================================================

export interface GhostwriterContact {
  name: string | null
  email: string
  company: string | null
  role: string | null
  relationship: string | null
  importance: string | null
  notes: string | null
}

export interface GhostwriterEmail {
  subject: string | null
  from_address: string
  from_name: string | null
  snippet: string | null
  received_at: string
}

export interface GhostwriterWhatsApp {
  body: string | null
  direction: string
  from_name: string | null
  received_at: string
}

export interface GhostwriterFollowUp {
  type: string
  subject: string
  commitment_text: string | null
  due_date: string | null
  status: string
}

export interface GhostwriterEvent {
  title: string
  start_time: string
  end_time: string
  location: string | null
}

export interface GhostwriterContext {
  contact: GhostwriterContact | null
  recentEmails: GhostwriterEmail[]
  recentWhatsApp: GhostwriterWhatsApp[]
  activeFollowUps: GhostwriterFollowUp[]
  upcomingMeetings: GhostwriterEvent[]
  writingStyleNotes: string | null
}

function formatGhostwriterContext(ctx: GhostwriterContext): string {
  const blocks: string[] = []

  // --- Contact profile ---
  if (ctx.contact) {
    const c = ctx.contact
    const parts = [
      c.name && `Name: ${c.name}`,
      c.company && `Company: ${c.company}`,
      c.role && `Role: ${c.role}`,
      c.relationship && `Relationship: ${c.relationship}`,
      c.importance && `Importance: ${c.importance}`,
      c.notes && `Notes: ${c.notes}`,
    ].filter(Boolean)
    if (parts.length) {
      blocks.push(`[CONTACT PROFILE]\n${parts.join('\n')}`)
    }
  }

  // --- Cross-channel interaction history ---
  if (ctx.recentEmails.length) {
    const lines = ctx.recentEmails.map(
      (e) =>
        `- ${e.received_at.slice(0, 10)} | From: ${e.from_name || e.from_address} | Subject: ${e.subject || '(no subject)'}\n  ${(e.snippet || '').slice(0, 120)}`,
    )
    blocks.push(`[RECENT EMAILS (last 5)]\n${lines.join('\n')}`)
  }

  if (ctx.recentWhatsApp.length) {
    const lines = ctx.recentWhatsApp.map(
      (m) =>
        `- ${m.received_at.slice(0, 10)} | ${m.direction === 'inbound' ? 'Them' : 'You'}: ${(m.body || '').slice(0, 120)}`,
    )
    blocks.push(`[RECENT WHATSAPP (last 5)]\n${lines.join('\n')}`)
  }

  // --- Active commitments ---
  if (ctx.activeFollowUps.length) {
    const lines = ctx.activeFollowUps.map((f) => {
      const typeLabel =
        f.type === 'i_promised'
          ? 'You promised'
          : f.type === 'waiting_on_them'
            ? 'Waiting on them'
            : 'Reply needed'
      return `- [${typeLabel}] ${f.subject}: ${f.commitment_text || '(no detail)'}${f.due_date ? ` — due ${f.due_date}` : ''}`
    })
    blocks.push(`[ACTIVE COMMITMENTS]\n${lines.join('\n')}`)
  }

  // --- Calendar context ---
  if (ctx.upcomingMeetings.length) {
    const lines = ctx.upcomingMeetings.map(
      (e) =>
        `- ${e.start_time.slice(0, 16)} — ${e.title}${e.location ? ` @ ${e.location}` : ''}`,
    )
    blocks.push(`[UPCOMING MEETINGS WITH THIS CONTACT]\n${lines.join('\n')}`)
  }

  // --- Writing style ---
  if (ctx.writingStyleNotes) {
    blocks.push(`[USER WRITING STYLE]\n${ctx.writingStyleNotes}`)
  }

  return blocks.length
    ? `=== GHOSTWRITER CONTEXT ===\n${blocks.join('\n\n')}\n=== END CONTEXT ===`
    : ''
}

export const REPLY_DRAFT_SYSTEM = `You are the Ghostwriter Agent — an AI email assistant that drafts replies indistinguishable from the user's own writing.

You receive two kinds of input:
1. GHOSTWRITER CONTEXT — background intelligence about the contact, interaction history across email and WhatsApp, active commitments, upcoming meetings, and the user's writing style.
2. The current email thread and drafting instructions.

Your rules:
- Use the context to write a reply that feels relationship-aware. Reference shared history, honor active commitments, and acknowledge upcoming meetings when relevant.
- Adapt your voice to match the user's writing style notes if provided.
- Match the requested tone:
  - formal: Professional, structured, suitable for clients and executives
  - friendly: Warm but professional, suitable for colleagues
  - brief: Short and to the point, 2-3 sentences max
- If the contact is VIP or high importance, be especially careful and thorough.
- Never fabricate facts. If the context doesn't contain relevant information, do not invent it.
- Output only the email body text. No subject line, no greeting header unless natural.`

export const REPLY_DRAFT_USER = (params: {
  thread: string
  tone: 'formal' | 'friendly' | 'brief'
  instructions?: string
  ghostwriterContext?: GhostwriterContext
}) => {
  const ctxBlock = params.ghostwriterContext
    ? formatGhostwriterContext(params.ghostwriterContext) + '\n\n'
    : ''

  return `${ctxBlock}Email thread:
${params.thread.slice(0, 4000)}

Tone: ${params.tone}
${params.instructions ? `Additional instructions: ${params.instructions}` : ''}

Draft a reply:`
}

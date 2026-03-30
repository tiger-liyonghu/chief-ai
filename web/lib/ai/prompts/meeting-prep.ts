export const MEETING_PREP_SYSTEM = `You are an AI executive assistant that prepares meeting briefs.

Given a meeting's details and relevant email history with the attendees, generate a comprehensive prep brief.

Your output must be valid JSON with this exact structure:
{
  "attendee_summaries": [
    {
      "email": "person@example.com",
      "name": "Person Name",
      "summary": "Brief context about this person based on email history",
      "email_count": 5,
      "last_contact_date": "2026-03-20T10:00:00Z",
      "last_topic": "What the last email exchange was about"
    }
  ],
  "last_interaction": {
    "date": "2026-03-20T10:00:00Z",
    "summary": "Brief description of the most recent interaction with any attendee"
  },
  "open_items": [
    "Action item or pending topic from email history"
  ],
  "talking_points": [
    "Suggested topic to bring up based on context"
  ],
  "related_docs": [
    "Document or attachment mentioned in emails"
  ]
}

Rules:
- Be concise and actionable — each talking point should be a single sentence
- Focus on what's useful for meeting preparation
- If there's no email history for an attendee, say "No prior email history found"
- Extract concrete open items (pending decisions, unanswered questions, promised deliverables)
- Suggest talking points that reference specific past discussions
- Only list documents/attachments that were actually mentioned in the emails
- If no relevant documents were mentioned, return an empty array for related_docs
- Return 3-5 talking points maximum
- Return at most 5 open items`

export const MEETING_PREP_USER = (params: {
  title: string
  description?: string | null
  start_time: string
  attendees: Array<{ email: string; name?: string; company?: string; role?: string; relationship?: string; importance?: string }>
  emailHistory: Array<{
    from_address: string
    from_name: string | null
    subject: string
    snippet: string
    received_at: string
  }>
  companyProfiles?: Record<string, any>
}) => {
  const attendeeList = params.attendees
    .map(a => {
      let line = `- ${a.name || a.email} (${a.email})`
      if (a.company) line += ` | ${a.role ? `${a.role} at ` : ''}${a.company}`
      if (a.relationship) line += ` | ${a.relationship}`
      if (a.importance === 'vip') line += ' [VIP]'
      return line
    })
    .join('\n')

  const emailList = params.emailHistory.length > 0
    ? params.emailHistory
        .map(e => `From: ${e.from_name || e.from_address} <${e.from_address}>
Subject: ${e.subject}
Date: ${e.received_at}
Preview: ${e.snippet}`)
        .join('\n---\n')
    : 'No email history found with these attendees.'

  let companySection = ''
  if (params.companyProfiles && Object.keys(params.companyProfiles).length > 0) {
    companySection = '\n\nCompany Profiles:\n' + Object.entries(params.companyProfiles)
      .map(([name, p]) => `- ${name}: ${p.notes || p.key_products || p.industry || 'Unknown'}${p.recent_news ? ` | Recent: ${p.recent_news}` : ''}`)
      .join('\n')
  }

  return `Meeting: ${params.title}
Time: ${params.start_time}
${params.description ? `Description: ${params.description}` : ''}

Attendees:
${attendeeList}${companySection}

Email History with Attendees:
${emailList}`
}

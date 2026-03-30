import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { COMMITMENT_EXTRACTION_SYSTEM } from '@/lib/ai/prompts/commitment-extraction'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { shouldSkipEmail, postFilterCommitments } from '@/lib/ai/commitment-filters'
import { getPersonalizedPrompt } from '@/lib/ai/personalized-prompt'

/**
 * Commitment Scanner — the 30-second cold-start hook.
 * Scans recent emails (both inbound + outbound) to extract Active Promises.
 * Called on first connect or on-demand from dashboard.
 */

const INBOUND_EXTRACTION_SYSTEM = `You are an AI assistant that extracts commitments from INBOUND emails (emails received BY the user FROM others).

Analyze the received message and identify two types of commitments:

1. **they_promised**: Things the sender committed to do for the user.
   - Patterns: "I'll send you", "We will", "Let me get back", "Will share", "I'll follow up", "我来处理", "下周给你", "回头发给你"

2. **i_promised**: Things the sender is ASKING the user to do (creating an obligation).
   - Patterns: "Could you please", "Can you send", "We need you to", "Please review", "请帮忙", "麻烦你", "能不能"

For each commitment found, provide:
- type: "i_promised" | "they_promised"
- title: Concise description (verb-first, e.g., "Review Q2 report for David")
- due_date: ISO date if a deadline is mentioned or implied, null otherwise
- confidence: 0.0-1.0

Rules:
- Only extract genuine commitments, not pleasantries or FYI messages
- Be conservative: confidence < 0.5 will be filtered out
- CC/newsletter emails typically have NO commitments
- Detect language automatically (English/Chinese/mixed)

Respond in JSON:
{
  "commitments": [...],
  "summary": "One sentence summary"
}`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const rawHours = Number(body.hours)
  const hours = Number.isFinite(rawHours) && rawHours > 0 ? Math.min(rawHours, 168) : 24
  const since = new Date(Date.now() - hours * 3600000).toISOString()

  // 1. Get recent emails not yet scanned
  const { data: emails } = await supabase
    .from('emails')
    .select('id, from_address, from_name, to_address, subject, snippet, date, is_outbound, commitment_scanned')
    .eq('user_id', user.id)
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(50)

  if (!emails || emails.length === 0) {
    return NextResponse.json({ scanned: 0, found: 0, commitments: [] })
  }

  // Filter to unscanned emails + pre-filter
  const unscanned = emails.filter(e => {
    if (e.commitment_scanned) return false
    const pf = shouldSkipEmail({
      from_address: e.from_address || '',
      from_name: e.from_name || '',
      subject: e.subject || '',
      snippet: e.snippet || '',
      to_address: e.to_address || '',
      is_outbound: e.is_outbound || false,
    })
    return !pf.skip
  })
  if (unscanned.length === 0) {
    // Return existing commitments instead
    const { data: existing } = await supabase
      .from('commitments')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress', 'overdue'])
      .order('urgency_score', { ascending: false })
      .limit(20)
    return NextResponse.json({ scanned: 0, found: 0, commitments: existing || [], already_scanned: true })
  }

  // 2. Get LLM client + personalized prompt
  const { client: ai, model } = await createUserAIClient(user.id)
  const personalizedBlock = await getPersonalizedPrompt(user.id)

  // 3. Batch emails into groups for LLM processing
  const newCommitments: Array<{
    type: string; title: string; contact_email: string;
    contact_name: string | null; deadline: string | null; confidence: number;
    source_email_id: string;
  }> = []

  // Process in batches of 5
  for (let i = 0; i < unscanned.length; i += 5) {
    const batch = unscanned.slice(i, i + 5)
    const emailSummaries = batch.map(e =>
      `---\nID: ${e.id}\nFrom: ${e.from_name || e.from_address}\nTo: ${e.to_address}\nSubject: ${e.subject}\nDate: ${e.date}\nDirection: ${e.is_outbound ? 'OUTBOUND (user sent)' : 'INBOUND (user received)'}\nSnippet: ${(e.snippet || '').slice(0, 500)}\n---`
    ).join('\n\n')

    let systemPrompt = `You extract commitments from a batch of emails. For INBOUND emails: ${INBOUND_EXTRACTION_SYSTEM}\nFor OUTBOUND emails: ${COMMITMENT_EXTRACTION_SYSTEM}\n\nReturn JSON: { "results": [{ "email_id": "...", "commitments": [{ "type", "title", "due_date", "confidence" }] }] }`

    // Append personalized few-shot examples if available
    if (personalizedBlock) {
      systemPrompt += '\n' + personalizedBlock
    }

    try {
      const aiRes = await ai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Scan these ${batch.length} emails for commitments:\n\n${emailSummaries}` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      })

      const content = aiRes.choices?.[0]?.message?.content
      if (!content) continue

      const parsed = JSON.parse(content)
      for (const result of parsed.results || []) {
        const email = batch.find(e => e.id === result.email_id)
        if (!email) continue

        for (const c of result.commitments || []) {
          if ((c.confidence || 0) < 0.5) continue
          newCommitments.push({
            type: c.type === 'waiting_on_them' ? 'they_promised' : c.type,
            title: c.title,
            contact_email: email.is_outbound ? (email.to_address || '') : (email.from_address || ''),
            contact_name: email.is_outbound ? null : (email.from_name || null),
            deadline: c.due_date || null,
            confidence: c.confidence,
            source_email_id: email.id,
          })
        }
      }
    } catch {
      // Continue with next batch on error
    }

    // Mark batch as scanned
    for (const email of batch) {
      await supabase
        .from('emails')
        .update({ commitment_scanned: true })
        .eq('id', email.id)
        .eq('user_id', user.id)
    }
  }

  // 4. Post-filter + Insert new commitments
  const { data: existingCommitments } = await supabase
    .from('commitments')
    .select('title, contact_email')
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress', 'overdue'])

  const existingTitles = (existingCommitments || []).map(c => c.title)

  // Post-filter: catch false positives the LLM missed
  const { passed: filteredCommitments } = postFilterCommitments(
    newCommitments.map(c => ({ type: c.type, title: c.title, confidence: c.confidence, due_date: c.deadline })),
    existingTitles
  )

  // Map back to full objects
  const toInsert = filteredCommitments.map(fc =>
    newCommitments.find(nc => nc.title === fc.title && nc.type === fc.type)!
  ).filter(Boolean)

  let inserted = 0
  for (const c of toInsert) {

    await supabase.from('commitments').insert({
      user_id: user.id,
      type: c.type,
      contact_email: c.contact_email,
      contact_name: c.contact_name,
      title: c.title,
      source_type: 'email',
      source_email_id: c.source_email_id,
      deadline: c.deadline,
      confidence: c.confidence,
      status: 'pending',
    })
    existingTitles.add(c.title.toLowerCase())
    inserted++
  }

  // 5. Return all active commitments
  const { data: allActive } = await supabase
    .from('commitments')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .order('urgency_score', { ascending: false })
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(20)

  return NextResponse.json({
    scanned: unscanned.length,
    found: inserted,
    commitments: allActive || [],
  })
}

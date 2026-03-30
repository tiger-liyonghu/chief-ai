import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * POST /api/organizations/enrich
 * Enrich an organization with AI-generated profile data.
 * Creates the org if it doesn't exist, updates if stale (>7 days).
 *
 * Body: { company_name: string, website?: string }
 * Returns: enriched organization record
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { company_name, website } = await request.json()
  if (!company_name) return NextResponse.json({ error: 'company_name required' }, { status: 400 })

  const admin = createAdminClient()

  // Check if organization already exists and is fresh
  const { data: existing } = await admin
    .from('organizations')
    .select('*')
    .eq('user_id', user.id)
    .ilike('name', company_name)
    .maybeSingle()

  if (existing) {
    // Check freshness — skip if updated within 7 days
    const updatedAt = existing.news_updated_at || existing.updated_at
    if (updatedAt) {
      const daysSinceUpdate = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceUpdate < 7) {
        return NextResponse.json(existing)
      }
    }
  }

  // Generate company profile via LLM
  try {
    const { client, model } = await createUserAIClient(user.id)
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a business intelligence analyst. Given a company name, provide a brief profile in JSON format. Use your knowledge to fill in what you know. If unsure, use null. Respond with ONLY valid JSON, no markdown.

Output format:
{
  "industry": "string — e.g. fintech, healthcare, SaaS",
  "size": "startup | sme | enterprise | mnc | government",
  "hq_city": "string or null",
  "hq_country": "string — 2-letter ISO code or null",
  "key_products": "string — brief, 1-2 sentences",
  "recent_news": "string — any notable recent developments, or null",
  "employee_count": number or null,
  "website": "string or null",
  "one_liner": "string — what the company does in one sentence"
}`,
        },
        {
          role: 'user',
          content: `Company: ${company_name}${website ? `\nWebsite: ${website}` : ''}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    })

    const content = completion.choices[0]?.message?.content?.trim() || '{}'

    let profile: Record<string, any>
    try {
      // Strip markdown code fences if present
      const jsonStr = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      profile = JSON.parse(jsonStr)
    } catch {
      profile = {}
    }

    const orgData = {
      user_id: user.id,
      name: company_name,
      industry: profile.industry || null,
      size: profile.size || null,
      hq_city: profile.hq_city || null,
      hq_country: profile.hq_country || null,
      website: profile.website || website || null,
      key_products: profile.key_products || null,
      recent_news: profile.recent_news || null,
      employee_count: profile.employee_count || null,
      notes: profile.one_liner || null,
      news_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    let org
    if (existing) {
      const { data } = await admin
        .from('organizations')
        .update(orgData)
        .eq('id', existing.id)
        .select()
        .single()
      org = data
    } else {
      const { data } = await admin
        .from('organizations')
        .insert(orgData)
        .select()
        .single()
      org = data
    }

    return NextResponse.json(org)
  } catch (err: any) {
    console.error('Organization enrichment failed:', err)
    return NextResponse.json({ error: err.message || 'Enrichment failed' }, { status: 500 })
  }
}

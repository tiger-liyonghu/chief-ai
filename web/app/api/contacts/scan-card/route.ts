import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * POST /api/contacts/scan-card
 * Scan a business card image and extract contact info.
 * Creates a contact and (optionally) an organization.
 *
 * Body: { image: string } — base64-encoded image data (with or without data URI prefix)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { image } = await request.json()
  if (!image) return NextResponse.json({ error: 'image (base64) required' }, { status: 400 })

  // Normalize base64: ensure it has the data URI prefix
  const imageUrl = image.startsWith('data:')
    ? image
    : `data:image/jpeg;base64,${image}`

  try {
    const { client, model } = await createUserAIClient(user.id)

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a business card scanner. Extract all visible contact information from the business card image. Return ONLY valid JSON with this structure:

{
  "name": "Full name",
  "company": "Company name or null",
  "role": "Job title or null",
  "email": "Email address or null",
  "phone": "Phone number (with country code if visible) or null",
  "website": "Website URL or null",
  "address": "Physical address or null",
  "linkedin": "LinkedIn URL or null",
  "notes": "Any other info visible on the card"
}

If a field is not visible on the card, use null. Extract all text including Chinese/Japanese/Korean characters. Be precise with email addresses and phone numbers.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Please scan this business card and extract the contact information.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ] as any,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    })

    const content = completion.choices[0]?.message?.content?.trim() || '{}'
    let extracted: Record<string, any>
    try {
      const jsonStr = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      extracted = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'Failed to parse card data', raw: content }, { status: 422 })
    }

    const admin = createAdminClient()
    const results: { contact?: any; organization?: any } = {}

    // Create or update contact
    if (extracted.name || extracted.email) {
      const contactData: Record<string, any> = {
        user_id: user.id,
        name: extracted.name || null,
        email: extracted.email || `unknown-${Date.now()}@scan`,
        company: extracted.company || null,
        role: extracted.role || null,
        phone: extracted.phone || null,
        notes: extracted.notes || null,
        source: 'card_scan',
        importance: 'normal',
        relationship: 'other',
      }

      if (extracted.email) {
        // Check for existing contact with same email
        const { data: existing } = await admin
          .from('contacts')
          .select('id')
          .eq('user_id', user.id)
          .eq('email', extracted.email)
          .maybeSingle()

        if (existing) {
          const { data } = await admin
            .from('contacts')
            .update({
              name: extracted.name || undefined,
              company: extracted.company || undefined,
              role: extracted.role || undefined,
              phone: extracted.phone || undefined,
            })
            .eq('id', existing.id)
            .select()
            .single()
          results.contact = { ...data, action: 'updated' }
        } else {
          const { data } = await admin
            .from('contacts')
            .insert(contactData)
            .select()
            .single()
          results.contact = { ...data, action: 'created' }
        }
      } else {
        const { data } = await admin
          .from('contacts')
          .insert(contactData)
          .select()
          .single()
        results.contact = { ...data, action: 'created' }
      }
    }

    // Create organization if company is detected
    if (extracted.company) {
      const { data: existingOrg } = await admin
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', extracted.company)
        .maybeSingle()

      if (!existingOrg) {
        const { data: newOrg } = await admin
          .from('organizations')
          .insert({
            user_id: user.id,
            name: extracted.company,
            website: extracted.website || null,
          })
          .select()
          .single()
        results.organization = { ...newOrg, action: 'created' }
      } else {
        results.organization = { id: existingOrg.id, name: extracted.company, action: 'exists' }
      }
    }

    return NextResponse.json({
      extracted,
      ...results,
    })
  } catch (err: any) {
    console.error('Card scan error:', err)
    return NextResponse.json({ error: err.message || 'Scan failed' }, { status: 500 })
  }
}

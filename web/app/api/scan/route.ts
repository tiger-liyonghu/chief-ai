import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * POST /api/scan
 * Universal image scanner (圈2 眼睛).
 * Accepts any image — auto-detects type and extracts actionable info.
 *
 * Supported input types:
 * - Business card → extract contact info, create contact + organization
 * - Chat screenshot (WhatsApp/WeChat/Telegram) → extract commitments, meetings, action items
 * - Whiteboard/notes → extract action items and decisions
 * - Receipt/invoice → extract expense data
 *
 * Body: { image: string } — base64-encoded image
 * Returns: { type, extracted, actions_taken }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { image } = await request.json()
  if (!image) return NextResponse.json({ error: 'image (base64) required' }, { status: 400 })

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
          content: `You are a visual intelligence assistant. Analyze the image and extract all actionable information. First determine the image type, then extract structured data.

Return ONLY valid JSON:

{
  "image_type": "business_card" | "chat_screenshot" | "whiteboard" | "receipt" | "document" | "other",
  "confidence": 0.0-1.0,
  "language": "detected language code",

  "contact": {
    "name": "string or null",
    "company": "string or null",
    "role": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "website": "string or null"
  },

  "commitments": [
    {
      "text": "what was promised",
      "who": "who promised (name)",
      "to_whom": "to whom",
      "deadline": "deadline if mentioned, or null",
      "type": "i_promised | they_promised"
    }
  ],

  "meetings": [
    {
      "title": "meeting subject",
      "date": "date if mentioned",
      "time": "time if mentioned",
      "participants": ["name1", "name2"],
      "location": "location or null"
    }
  ],

  "action_items": [
    "task or action to take"
  ],

  "expense": {
    "merchant": "string or null",
    "amount": number or null,
    "currency": "string or null",
    "date": "string or null",
    "category": "flight | hotel | transport | meal | other"
  },

  "raw_text": "all visible text transcribed"
}

Rules:
- Only fill in sections relevant to the image type
- For chat screenshots: extract commitments, meetings, and action items from the conversation
- For business cards: focus on contact info
- For receipts: focus on expense data
- Be precise with numbers, dates, emails, and phone numbers
- Support Chinese, English, Malay, and mixed-language content`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Scan this image and extract all actionable information.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ] as any,
        },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    })

    const content = completion.choices[0]?.message?.content?.trim() || '{}'
    let extracted: Record<string, any>
    try {
      const jsonStr = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      extracted = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'Failed to parse scan result', raw: content }, { status: 422 })
    }

    const admin = createAdminClient()
    const actionsTaken: string[] = []

    // --- Auto-create contact from business card ---
    if (extracted.image_type === 'business_card' && extracted.contact) {
      const c = extracted.contact
      if (c.name || c.email) {
        const email = c.email || `scan-${Date.now()}@unknown`
        const { data: existing } = await admin
          .from('contacts')
          .select('id')
          .eq('user_id', user.id)
          .eq('email', email)
          .maybeSingle()

        if (existing) {
          await admin.from('contacts').update({
            name: c.name || undefined,
            company: c.company || undefined,
            role: c.role || undefined,
            phone: c.phone || undefined,
          }).eq('id', existing.id)
          actionsTaken.push(`Updated contact: ${c.name || email}`)
        } else {
          await admin.from('contacts').insert({
            user_id: user.id,
            name: c.name,
            email,
            company: c.company,
            role: c.role,
            phone: c.phone,
            source: 'card_scan',
            importance: 'normal',
            relationship: 'other',
          })
          actionsTaken.push(`Created contact: ${c.name || email}`)
        }

        // Create organization if company detected
        if (c.company) {
          const { data: existingOrg } = await admin
            .from('organizations')
            .select('id')
            .eq('user_id', user.id)
            .ilike('name', c.company)
            .maybeSingle()
          if (!existingOrg) {
            await admin.from('organizations').insert({
              user_id: user.id,
              name: c.company,
              website: c.website,
            })
            actionsTaken.push(`Created organization: ${c.company}`)
          }
        }
      }
    }

    // --- Auto-create commitments from chat screenshots ---
    if (extracted.commitments && extracted.commitments.length > 0) {
      for (const commitment of extracted.commitments) {
        // Dedup check
        const { data: existing } = await admin
          .from('commitments')
          .select('id')
          .eq('user_id', user.id)
          .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])
          .ilike('title', `%${commitment.text.slice(0, 30)}%`)
          .limit(1)

        if (!existing || existing.length === 0) {
          await admin.from('commitments').insert({
            user_id: user.id,
            type: commitment.type || 'i_promised',
            title: commitment.text,
            contact_name: commitment.who || commitment.to_whom || null,
            source_type: 'voice',  // "scanned" — closest available
            deadline: commitment.deadline || null,
            urgency_score: 0,
            confidence: extracted.confidence || 0.7,
            status: 'pending',
          })
          actionsTaken.push(`Created commitment: ${commitment.text.slice(0, 50)}`)
        }
      }
    }

    // --- Auto-create expense from receipt ---
    if (extracted.image_type === 'receipt' && extracted.expense?.amount) {
      const exp = extracted.expense
      await admin.from('trip_expenses').insert({
        user_id: user.id,
        category: exp.category || 'other',
        merchant_name: exp.merchant || 'Unknown',
        amount: exp.amount,
        currency: exp.currency || 'SGD',
        expense_date: exp.date || new Date().toISOString().slice(0, 10),
        status: 'pending',
        notes: 'Scanned from receipt image',
      })
      actionsTaken.push(`Created expense: ${exp.currency || 'SGD'} ${exp.amount} at ${exp.merchant || 'Unknown'}`)
    }

    return NextResponse.json({
      type: extracted.image_type,
      extracted,
      actions_taken: actionsTaken,
    })
  } catch (err: any) {
    console.error('Scan error:', err)
    return NextResponse.json({ error: err.message || 'Scan failed' }, { status: 500 })
  }
}

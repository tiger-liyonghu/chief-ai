import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_FIELDS = [
  'timezone',
  'language',
  'daily_brief_time',
  'gdpr_data_retention_days',
  'writing_style_notes',
  'assistant_name',
] as const

type SettingsField = typeof ALLOWED_FIELDS[number]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('timezone, language, daily_brief_time, gdpr_data_retention_days, writing_style_notes, assistant_name')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(profile)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Whitelist: only allow known settings fields
  const updates: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Validate specific fields
  if ('gdpr_data_retention_days' in updates) {
    const days = updates.gdpr_data_retention_days as number
    if (!Number.isInteger(days) || days < 30 || days > 365) {
      return NextResponse.json(
        { error: 'gdpr_data_retention_days must be an integer between 30 and 365' },
        { status: 400 }
      )
    }
  }

  if ('language' in updates) {
    const lang = updates.language as string
    if (!['en', 'zh', 'ms'].includes(lang)) {
      return NextResponse.json(
        { error: 'Language must be one of: en, zh, ms' },
        { status: 400 }
      )
    }
  }

  if ('timezone' in updates) {
    const tz = updates.timezone as string
    if (typeof tz !== 'string' || tz.length === 0 || tz.length > 50) {
      return NextResponse.json(
        { error: 'Invalid timezone' },
        { status: 400 }
      )
    }
  }

  if ('assistant_name' in updates) {
    const name = updates.assistant_name as string
    if (typeof name !== 'string' || name.length > 30) {
      return NextResponse.json(
        { error: 'assistant_name must be a string up to 30 characters' },
        { status: 400 }
      )
    }
  }

  if ('daily_brief_time' in updates) {
    const time = updates.daily_brief_time as string
    if (typeof time !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
      return NextResponse.json(
        { error: 'daily_brief_time must be in HH:MM or HH:MM:SS format' },
        { status: 400 }
      )
    }
  }

  updates.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * DELETE /api/account/delete
 * GDPR-compliant account deletion. Cascades all user data.
 * Requires explicit confirmation string in request body.
 *
 *纲领原则#9: 可删除。用户说删就删。所有数据，包括Sophia的记忆，随时可清零。
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  if (body.confirmation !== 'DELETE_MY_ACCOUNT') {
    return NextResponse.json({
      error: 'Confirmation required. Send { "confirmation": "DELETE_MY_ACCOUNT" }',
    }, { status: 400 })
  }

  const admin = createAdminClient()
  const userId = user.id

  // Delete in dependency order (children before parents)
  const tables = [
    'commitment_feedback',
    'sophia_memories',
    'sophia_interventions',
    'chat_sessions',
    'user_behavior_profile',
    'meeting_briefs',
    'trip_expenses',
    'trip_timeline',
    'daily_briefings',
    'notification_log',
    'reply_drafts',
    'whatsapp_messages',
    'entity_signals',
    'relations',
    'commitments',
    'tasks',
    'follow_ups',
    'contacts',
    'calendar_events',
    'family_calendar',
    'trips',
    'emails',
    'sync_log',
    'google_tokens',
    'llm_configs',
    'deal_pipeline',
    'organizations',
  ]

  const errors: string[] = []

  for (const table of tables) {
    try {
      await admin.from(table).delete().eq('user_id', userId)
    } catch (err: any) {
      // Some tables may not exist or have different FK structure
      errors.push(`${table}: ${err.message}`)
    }
  }

  // Delete profile last
  try {
    await admin.from('profiles').delete().eq('id', userId)
  } catch (err: any) {
    errors.push(`profiles: ${err.message}`)
  }

  // Delete auth user
  try {
    await admin.auth.admin.deleteUser(userId)
  } catch (err: any) {
    errors.push(`auth: ${err.message}`)
  }

  return NextResponse.json({
    deleted: true,
    tables_cleaned: tables.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}

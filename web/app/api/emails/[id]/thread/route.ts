import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get the email to find its thread_id
  const { data: email, error } = await admin
    .from('emails')
    .select('thread_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !email || !email.thread_id) {
    return NextResponse.json([])
  }

  // Fetch all emails in the same thread, ordered by received_at
  const { data: threadEmails } = await admin
    .from('emails')
    .select('id, subject, from_name, from_address, snippet, body_text, received_at, thread_id')
    .eq('user_id', user.id)
    .eq('thread_id', email.thread_id)
    .neq('id', id) // exclude the selected email itself
    .order('received_at', { ascending: true })

  return NextResponse.json(threadEmails || [])
}

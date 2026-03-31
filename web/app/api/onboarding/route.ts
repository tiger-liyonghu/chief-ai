import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicOrigin } from '@/lib/auth/redirect'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Check if already onboarded
    const { data: profile } = await admin
      .from('profiles')
      .select('onboarding_completed_at, timezone, language')
      .eq('id', user.id)
      .single()

    if (profile?.onboarding_completed_at) {
      return NextResponse.json({ ok: true, already_onboarded: true })
    }

    // Read client-detected settings
    const body = await request.json().catch(() => ({}))
    const { timezone, language } = body as { timezone?: string; language?: string }

    // Step 1: Save auto-detected settings
    const settingsUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (timezone && typeof timezone === 'string' && timezone.length <= 50) {
      settingsUpdate.timezone = timezone
    }

    if (language && ['en', 'zh'].includes(language)) {
      settingsUpdate.language = language
    }

    // Mark onboarding complete FIRST — this is the gate that prevents redirect loops.
    // Background tasks (sync, process, trips, contacts) must never block this write.
    settingsUpdate.onboarding_completed_at = new Date().toISOString()
    await admin.from('profiles').update(settingsUpdate).eq('id', user.id)

    // Step 2: Trigger background setup steps (fire-and-forget)
    // These run after onboarding_completed_at is already written,
    // so even if they fail or timeout, the user can enter the dashboard.
    const baseUrl = getPublicOrigin(request.url, request.headers)
    const cookieHeader = request.headers.get('cookie') || ''

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    }

    const stepsTriggered: string[] = []
    const stepResults: Record<string, any> = {}

    // Sync emails → process → trips + contacts
    try {
      const syncRes = await fetch(`${baseUrl}/api/sync`, { method: 'POST', headers })
      const syncData = await syncRes.json()
      stepsTriggered.push('sync')
      stepResults.sync = syncData
    } catch (err) {
      console.error('Onboarding: sync failed', err)
      stepResults.sync = { error: 'failed' }
    }

    try {
      const processRes = await fetch(`${baseUrl}/api/sync/process`, { method: 'POST', headers })
      const processData = await processRes.json()
      stepsTriggered.push('process')
      stepResults.process = processData
    } catch (err) {
      console.error('Onboarding: process failed', err)
      stepResults.process = { error: 'failed' }
    }

    const [tripResult, contactResult] = await Promise.allSettled([
      fetch(`${baseUrl}/api/trips/detect`, { method: 'POST', headers }).then(r => r.json()),
      fetch(`${baseUrl}/api/contacts/detect`, { method: 'POST', headers }).then(r => r.json()),
    ])

    if (tripResult.status === 'fulfilled') {
      stepsTriggered.push('trips')
      stepResults.trips = tripResult.value
    } else {
      stepResults.trips = { error: 'failed' }
    }

    if (contactResult.status === 'fulfilled') {
      stepsTriggered.push('contacts')
      stepResults.contacts = contactResult.value
    } else {
      stepResults.contacts = { error: 'failed' }
    }

    return NextResponse.json({
      ok: true,
      steps_triggered: stepsTriggered,
      results: stepResults,
    })
  } catch (error: any) {
    console.error('Onboarding error:', error)
    return NextResponse.json({ error: 'Onboarding failed' }, { status: 500 })
  }
}

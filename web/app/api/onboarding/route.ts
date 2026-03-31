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

    if (Object.keys(settingsUpdate).length > 1) {
      await admin.from('profiles').update(settingsUpdate).eq('id', user.id)
    }

    // Step 2: Trigger all automatic setup steps in parallel
    // We use internal fetch with the user's cookies forwarded
    const baseUrl = getPublicOrigin(request.url, request.headers)
    const cookieHeader = request.headers.get('cookie') || ''

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    }

    const stepsTriggered: string[] = []
    const stepResults: Record<string, any> = {}

    // Step 2a: Sync emails (metadata)
    try {
      const syncRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers,
      })
      const syncData = await syncRes.json()
      stepsTriggered.push('sync')
      stepResults.sync = syncData
    } catch (err) {
      console.error('Onboarding: sync failed', err)
      stepResults.sync = { error: 'failed' }
    }

    // Step 2b: AI processing (runs after sync so there are emails to process)
    try {
      const processRes = await fetch(`${baseUrl}/api/sync/process`, {
        method: 'POST',
        headers,
      })
      const processData = await processRes.json()
      stepsTriggered.push('process')
      stepResults.process = processData
    } catch (err) {
      console.error('Onboarding: process failed', err)
      stepResults.process = { error: 'failed' }
    }

    // Step 2c: Trip detection and contact detection (can run in parallel)
    const [tripResult, contactResult] = await Promise.allSettled([
      fetch(`${baseUrl}/api/trips/detect`, { method: 'POST', headers })
        .then(r => r.json()),
      fetch(`${baseUrl}/api/contacts/detect`, { method: 'POST', headers })
        .then(r => r.json()),
    ])

    if (tripResult.status === 'fulfilled') {
      stepsTriggered.push('trips')
      stepResults.trips = tripResult.value
    } else {
      console.error('Onboarding: trip detection failed', tripResult.reason)
      stepResults.trips = { error: 'failed' }
    }

    if (contactResult.status === 'fulfilled') {
      stepsTriggered.push('contacts')
      stepResults.contacts = contactResult.value
    } else {
      console.error('Onboarding: contact detection failed', contactResult.reason)
      stepResults.contacts = { error: 'failed' }
    }

    // Step 3: Mark onboarding complete
    await admin.from('profiles').update({
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', user.id)

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

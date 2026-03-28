import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTravelBriefing } from '@/lib/travel/knowledge'

/**
 * GET /api/agents/travel-brain/briefing?city=singapore
 *
 * Returns a structured multi-section travel briefing for a given city.
 * Personalizes content based on user profile (nationality, industry) if available.
 */
export async function GET(request: NextRequest) {
  // --- Auth ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Parse query ---
  const city = request.nextUrl.searchParams.get('city')
  if (!city) {
    return NextResponse.json(
      { error: 'Missing required query parameter: city' },
      { status: 400 }
    )
  }

  // --- Fetch user profile for personalization ---
  let nationality: string | undefined
  let industry: string | undefined

  try {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('nationality, industry')
      .eq('id', user.id)
      .single()

    if (profile) {
      nationality = profile.nationality ?? undefined
      industry = profile.industry ?? undefined
    }
  } catch {
    // Profile fields may not exist yet - fall through to generic briefing
  }

  // --- Generate briefing ---
  const briefing = generateTravelBriefing(city, { nationality, industry })

  if (!briefing) {
    return NextResponse.json(
      {
        error: `No travel knowledge available for "${city}". Currently supported: Singapore.`,
        supported_cities: ['singapore'],
      },
      { status: 404 }
    )
  }

  return NextResponse.json(briefing)
}

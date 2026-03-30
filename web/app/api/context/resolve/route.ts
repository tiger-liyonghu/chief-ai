import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveContext, contextToPrompt } from '@/lib/ontology/resolve-context'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (!body.entity_id) {
    return NextResponse.json({ error: 'entity_id is required' }, { status: 400 })
  }

  const layer = body.layer as 1 | 2 | 3 | undefined

  try {
    const bundle = await resolveContext(supabase, user.id, body.entity_id, {
      entityType: body.entity_type,
      maxHops: body.max_hops || (layer === 3 ? 2 : 1),
      hydrateEntities: true,
    })

    return NextResponse.json({
      bundle,
      // Include pre-formatted prompt text for convenience
      prompt: layer ? contextToPrompt(bundle, layer) : contextToPrompt(bundle, 1),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

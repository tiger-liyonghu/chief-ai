/**
 * Unified auth guard for API routes.
 * Reduces boilerplate across 30+ API routes.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface AuthResult {
  user: { id: string; email?: string }
  error?: never
}

interface AuthError {
  user?: never
  error: NextResponse
}

/**
 * Get authenticated user or return a standardized 401 response.
 *
 * Usage:
 * ```ts
 * const { user, error } = await requireAuth()
 * if (error) return error
 * // user is guaranteed to exist here
 * ```
 */
export async function requireAuth(): Promise<AuthResult | AuthError> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        error: NextResponse.json(
          { error: 'Authentication required', code: 'AUTH_REQUIRED' },
          { status: 401 },
        ),
      }
    }

    return { user: { id: user.id, email: user.email } }
  } catch {
    return {
      error: NextResponse.json(
        { error: 'Authentication failed', code: 'AUTH_FAILED' },
        { status: 401 },
      ),
    }
  }
}

/**
 * Verify cron secret for Vercel Cron routes.
 */
export function requireCronAuth(authHeader: string | null): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return null

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

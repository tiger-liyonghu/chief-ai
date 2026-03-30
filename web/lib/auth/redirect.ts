/**
 * Build redirect URL using NEXT_PUBLIC_APP_URL as base.
 * Solves the problem where request.url in Docker containers
 * resolves to http://0.0.0.0:3000 instead of the public domain.
 */
export function buildRedirectUrl(path: string, requestUrl: string): URL {
  const base = process.env.NEXT_PUBLIC_APP_URL || requestUrl
  return new URL(path, base)
}

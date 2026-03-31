/**
 * Resolve the public-facing origin of this app.
 *
 * Inside Docker / Railway, request.url is http://0.0.0.0:3000.
 * This function returns the real public URL by checking (in order):
 * 1. NEXT_PUBLIC_APP_URL env var
 * 2. x-forwarded-host + x-forwarded-proto headers (reverse proxy)
 * 3. host header (direct access, non-loopback)
 * 4. requestUrl fallback
 */
export function getPublicOrigin(requestUrl: string, headers?: Headers): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }

  if (headers) {
    const fwdHost = headers.get('x-forwarded-host')
    const fwdProto = headers.get('x-forwarded-proto') || 'https'
    if (fwdHost) return `${fwdProto}://${fwdHost}`

    const host = headers.get('host')
    if (host && !/^(0\.0\.0\.0|127\.0\.0\.1|localhost)(:|$)/.test(host)) {
      return `https://${host}`
    }
  }

  return new URL(requestUrl).origin
}

/**
 * Build a redirect URL using the public origin.
 */
export function buildRedirectUrl(path: string, requestUrl: string, headers?: Headers): URL {
  return new URL(path, getPublicOrigin(requestUrl, headers))
}

/**
 * Auth-aware fetch wrapper.
 * Returns null instead of throwing on 401/403, letting the UI show graceful empty states.
 */
export async function fetchSafe<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, options)
    if (res.status === 401 || res.status === 403) {
      return null // Not authenticated — let UI handle gracefully
    }
    if (!res.ok) {
      return null // Other errors — degrade gracefully
    }
    return res.json()
  } catch {
    return null // Network error — degrade gracefully
  }
}

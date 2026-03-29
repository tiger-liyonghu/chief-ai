import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Fix double-encoded UTF-8 strings (e.g. "Ã¤Â½Â " → "你") */
export function fixDoubleUtf8(str: string): string {
  // Detect mojibake: Ã (U+00C3) followed by a char in 0x80-0xBF range is classic double-UTF8
  if (!/\u00C3[\u0080-\u00BF]/.test(str)) return str
  try {
    const bytes = new Uint8Array([...str].map(c => c.charCodeAt(0) & 0xFF))
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    // Sanity check: decoded should be shorter and contain fewer replacement chars than original
    if (decoded.length < str.length && (decoded.match(/\uFFFD/g) || []).length < str.length * 0.3) {
      return decoded
    }
    return str
  } catch {
    return str
  }
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/**
 * Extract city name from email signature or body text.
 *
 * Uses regex matching for common APAC business cities.
 * No LLM needed — regex is fast and accurate enough for top cities.
 *
 * Returns null if no city found (better to have no data than wrong data).
 */

// Canonical city names → patterns that match in email signatures
const CITY_PATTERNS: Array<{ city: string; patterns: RegExp[] }> = [
  { city: 'Singapore', patterns: [/\bSingapore\b/i, /\bSG\b(?=\s|\d|$)/] },
  { city: 'Kuala Lumpur', patterns: [/\bKuala\s*Lumpur\b/i, /\bKL\b(?=\s|\d|$)/, /\bMalaysia\b/i] },
  { city: 'Jakarta', patterns: [/\bJakarta\b/i] },
  { city: 'Bangkok', patterns: [/\bBangkok\b/i] },
  { city: 'Tokyo', patterns: [/\bTokyo\b/i, /東京/] },
  { city: 'Hong Kong', patterns: [/\bHong\s*Kong\b/i, /\bHK\b(?=\s|\d|$)/, /香港/] },
  { city: 'Shanghai', patterns: [/\bShanghai\b/i, /上海/] },
  { city: 'Beijing', patterns: [/\bBeijing\b/i, /北京/] },
  { city: 'Shenzhen', patterns: [/\bShenzhen\b/i, /深圳/] },
  { city: 'Taipei', patterns: [/\bTaipei\b/i, /台北/] },
  { city: 'Seoul', patterns: [/\bSeoul\b/i, /서울/] },
  { city: 'Mumbai', patterns: [/\bMumbai\b/i, /\bBombay\b/i] },
  { city: 'New Delhi', patterns: [/\bNew\s*Delhi\b/i, /\bDelhi\b/i] },
  { city: 'Bangalore', patterns: [/\bBangalore\b/i, /\bBengaluru\b/i] },
  { city: 'Sydney', patterns: [/\bSydney\b/i] },
  { city: 'Melbourne', patterns: [/\bMelbourne\b/i] },
  { city: 'Dubai', patterns: [/\bDubai\b/i] },
  { city: 'London', patterns: [/\bLondon\b/i] },
  { city: 'New York', patterns: [/\bNew\s*York\b/i, /\bNYC\b/i] },
  { city: 'San Francisco', patterns: [/\bSan\s*Francisco\b/i, /\bSF\b(?=\s|\d|$)/] },
]

/**
 * Try to extract a city from the last ~500 chars of email body (signature area).
 * Returns canonical city name or null.
 */
export function extractCityFromEmail(bodyText: string | null): string | null {
  if (!bodyText) return null

  // Focus on the signature area: last 500 chars (most signatures are at the bottom)
  const signatureArea = bodyText.slice(-500)

  for (const { city, patterns } of CITY_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(signatureArea)) {
        return city
      }
    }
  }

  return null
}

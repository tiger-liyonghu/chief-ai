/**
 * Travel knowledge engine.
 * Retrieves city data and generates context-aware briefings.
 */

import { CityKnowledge, CITY_KNOWLEDGE_REGISTRY } from './city-data'

// Re-export for convenience
export type { CityKnowledge }

/**
 * Look up structured knowledge for a city.
 * Accepts common aliases (e.g. "sg", "sin", "singapore").
 */
export function getCityKnowledge(city: string): CityKnowledge | null {
  const key = normalizeCity(city)
  return CITY_KNOWLEDGE_REGISTRY[key] ?? null
}

/**
 * Generate a multi-section travel briefing customized to the traveler.
 *
 * @param city       - Destination city name
 * @param userContext - Optional user profile fields for personalization
 * @returns Structured briefing with titled sections, or null if city unknown
 */
export function generateTravelBriefing(
  city: string,
  userContext?: { industry?: string; nationality?: string }
): BriefingResponse | null {
  const data = getCityKnowledge(city)
  if (!data) return null

  const nationality = (userContext?.nationality ?? '').toLowerCase()
  const industry = (userContext?.industry ?? '').toLowerCase()

  return {
    city: data.city,
    country: data.country,
    timezone: data.timezone,
    sections: [
      buildEntryVisaSection(data, nationality),
      buildCurrencySection(data),
      buildCultureSection(data, industry),
      buildHotelsSection(data),
      buildRestaurantsSection(data, industry),
      buildTransportSection(data),
      buildRunningSection(data),
      buildWeatherSection(data),
      buildConnectivitySection(data),
      buildEmergencySection(data, nationality),
    ],
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BriefingSection {
  title: string
  icon: string
  items: string[]
}

export interface BriefingResponse {
  city: string
  country: string
  timezone: string
  sections: BriefingSection[]
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildEntryVisaSection(data: CityKnowledge, nationality: string): BriefingSection {
  const items: string[] = []

  // Nationality-specific visa info
  if (nationality.includes('china') || nationality.includes('chinese') || nationality === 'cn') {
    items.push(`Visa: ${data.visa.cnPassport}`)
  } else if (nationality.includes('india') || nationality === 'in') {
    items.push(`Visa: ${data.visa.inPassport}`)
  } else if (nationality.includes('us') || nationality.includes('american') || nationality.includes('united states')) {
    items.push(`Visa: ${data.visa.usPassport}`)
  } else {
    // Show all visa info for unknown nationality
    items.push(`China passport: ${data.visa.cnPassport}`)
    items.push(`US passport: ${data.visa.usPassport}`)
    items.push(`India passport: ${data.visa.inPassport}`)
  }

  items.push(data.visa.general)
  items.push(...data.entry.tips)

  if (data.entry.prohibited.length > 0) {
    items.push(`PROHIBITED ITEMS: ${data.entry.prohibited.join('; ')}`)
  }

  return { title: 'Entry & Visa', icon: 'passport', items }
}

function buildCurrencySection(data: CityKnowledge): BriefingSection {
  return {
    title: 'Currency & Payments',
    icon: 'wallet',
    items: [
      `Currency: ${data.currency.code} (${data.currency.symbol})`,
      data.currency.cashAdvice,
      `Tipping: ${data.currency.tipping}`,
    ],
  }
}

function buildCultureSection(data: CityKnowledge, industry: string): BriefingSection {
  const items = [...data.culture.businessEtiquette]

  items.push(`Religious sensitivity: ${data.culture.religiousSensitivity}`)

  // Industry-specific dress code
  if (industry.includes('financ') || industry.includes('bank') || industry.includes('insurance') || industry.includes('fund')) {
    items.push(`Dress code (${industry}): ${data.culture.dressCode.finance}`)
  } else if (industry.includes('tech') || industry.includes('software') || industry.includes('startup')) {
    items.push(`Dress code (${industry}): ${data.culture.dressCode.tech}`)
  } else if (industry.includes('government') || industry.includes('public')) {
    items.push(`Dress code: ${data.culture.dressCode.government}`)
  } else {
    items.push(`Dress code: ${data.culture.dressCode.general}`)
  }

  return { title: 'Culture & Etiquette', icon: 'handshake', items }
}

function buildHotelsSection(data: CityKnowledge): BriefingSection {
  return {
    title: 'Hotels',
    icon: 'hotel',
    items: data.hotels.map(
      (h) =>
        `${h.name} (${h.area}) - ${h.priceRange}. ${h.highlights} MRT: ${h.nearestMrt}${h.runningNearby ? `. Running: ${h.runningNearby}` : ''}`
    ),
  }
}

function buildRestaurantsSection(data: CityKnowledge, industry: string): BriefingSection {
  const items: string[] = []

  // If finance/consulting, prioritize fine dining and client entertainment spots
  const isClientFacing =
    industry.includes('financ') ||
    industry.includes('consult') ||
    industry.includes('law') ||
    industry.includes('bank')

  if (isClientFacing) {
    items.push('--- Client Entertainment ---')
    for (const r of data.restaurants.filter((r) => r.priceRange.includes('200') || r.priceRange.includes('300') || r.priceRange.includes('400') || r.priceRange.includes('500'))) {
      items.push(`${r.name} (${r.cuisine}) - ${r.priceRange}. ${r.bestFor} ${r.note}`)
    }
    items.push('--- Local Favorites ---')
  }

  for (const r of data.restaurants.filter((r) => !items.some((i) => i.includes(r.name)))) {
    items.push(`${r.name} (${r.cuisine}) - ${r.priceRange}. ${r.bestFor} ${r.note}`)
  }

  return { title: 'Restaurants', icon: 'utensils', items }
}

function buildTransportSection(data: CityKnowledge): BriefingSection {
  return {
    title: 'Getting Around',
    icon: 'train',
    items: [
      `From airport: ${data.transport.fromAirport}`,
      `MRT: ${data.transport.mrt}`,
      `Taxi/Grab: ${data.transport.taxi}`,
      ...data.transport.tips,
    ],
  }
}

function buildRunningSection(data: CityKnowledge): BriefingSection {
  return {
    title: 'Running & Exercise',
    icon: 'running',
    items: data.runningRoutes.map(
      (r) => `${r.name} (${r.distance}): ${r.description} Start: ${r.startPoint}`
    ),
  }
}

function buildWeatherSection(data: CityKnowledge): BriefingSection {
  return {
    title: 'Weather & Packing',
    icon: 'sun',
    items: [
      data.weather.typical,
      `Rainy season: ${data.weather.rainyMonths}`,
      data.weather.packingAdvice,
      `Power socket: ${data.powerSocket}`,
    ],
  }
}

function buildConnectivitySection(data: CityKnowledge): BriefingSection {
  return {
    title: 'Connectivity',
    icon: 'wifi',
    items: [
      `SIM card: ${data.connectivity.simCard}`,
      `WiFi: ${data.connectivity.wifi}`,
      `VPN: ${data.connectivity.vpn}`,
    ],
  }
}

function buildEmergencySection(data: CityKnowledge, nationality: string): BriefingSection {
  const items = [
    `Police: ${data.emergency.police}`,
    `Ambulance / Fire: ${data.emergency.ambulance}`,
  ]

  // Show relevant embassy based on nationality
  if (nationality.includes('china') || nationality.includes('chinese') || nationality === 'cn') {
    items.push(data.emergency.embassy.china)
  } else if (nationality.includes('india') || nationality === 'in') {
    items.push(data.emergency.embassy.india)
  } else if (nationality.includes('us') || nationality.includes('american')) {
    items.push(data.emergency.embassy.usa)
  } else if (nationality.includes('uk') || nationality.includes('british')) {
    items.push(data.emergency.embassy.uk)
  } else if (nationality.includes('australia') || nationality.includes('australian')) {
    items.push(data.emergency.embassy.australia)
  } else {
    // Show all embassies for unknown nationality
    for (const [, value] of Object.entries(data.emergency.embassy)) {
      items.push(value)
    }
  }

  return { title: 'Emergency', icon: 'phone', items }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CITY_ALIASES: Record<string, string> = {
  singapore: 'singapore',
  sg: 'singapore',
  sin: 'singapore',
  'singapore city': 'singapore',
  spore: 'singapore',
}

function normalizeCity(raw: string): string {
  const cleaned = raw.trim().toLowerCase()
  return CITY_ALIASES[cleaned] ?? cleaned
}

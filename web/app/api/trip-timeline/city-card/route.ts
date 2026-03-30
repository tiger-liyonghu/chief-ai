import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/trip-timeline/city-card
 * Returns a city info card for the destination and stores it in trips.city_card JSONB.
 * Lookup-based for major SEA cities; returns sensible defaults for unknown cities.
 */

interface CityCard {
  city: string
  country: string
  timezone: string
  utc_offset: string
  currency: string
  currency_symbol: string
  exchange_rate_note: string
  plug_type: string
  voltage: string
  transport_tips: string[]
  emergency_number: string
  language: string
  tipping_culture: string
}

const CITY_DATABASE: Record<string, CityCard> = {
  singapore: {
    city: 'Singapore',
    country: 'Singapore',
    timezone: 'Asia/Singapore',
    utc_offset: 'UTC+8',
    currency: 'SGD',
    currency_symbol: 'S$',
    exchange_rate_note: 'Check XE.com for latest rates',
    plug_type: 'Type G (UK-style, 3-pin)',
    voltage: '230V / 50Hz',
    transport_tips: [
      'MRT is the fastest way around — use EZ-Link or SimplyGo contactless',
      'Grab is the main ride-hailing app (no Uber)',
      'Taxis are metered and reliable; surcharges apply during peak hours',
      'Bus network is extensive; use Google Maps for routes',
    ],
    emergency_number: '999 (police), 995 (ambulance/fire)',
    language: 'English, Mandarin, Malay, Tamil',
    tipping_culture: 'Not expected — 10% service charge usually included',
  },
  'kuala lumpur': {
    city: 'Kuala Lumpur',
    country: 'Malaysia',
    timezone: 'Asia/Kuala_Lumpur',
    utc_offset: 'UTC+8',
    currency: 'MYR',
    currency_symbol: 'RM',
    exchange_rate_note: 'Check XE.com for latest rates',
    plug_type: 'Type G (UK-style, 3-pin)',
    voltage: '240V / 50Hz',
    transport_tips: [
      'Grab is the dominant ride-hailing app',
      'KL Sentral is the main transit hub — LRT, MRT, KTM, monorail',
      'Touch n Go eWallet works for transit and parking',
      'Traffic jams are severe during rush hours — plan around them',
    ],
    emergency_number: '999 (police/ambulance/fire)',
    language: 'Malay, English widely spoken',
    tipping_culture: 'Not expected but appreciated for good service',
  },
  jakarta: {
    city: 'Jakarta',
    country: 'Indonesia',
    timezone: 'Asia/Jakarta',
    utc_offset: 'UTC+7',
    currency: 'IDR',
    currency_symbol: 'Rp',
    exchange_rate_note: 'Check XE.com for latest rates',
    plug_type: 'Type C / F (European-style, 2-pin round)',
    voltage: '230V / 50Hz',
    transport_tips: [
      'Grab and Gojek are the two main ride-hailing apps',
      'MRT Jakarta operates on the north-south corridor',
      'Traffic is extremely congested — avoid driving during rush hours',
      'TransJakarta BRT is affordable but crowded during peak times',
    ],
    emergency_number: '110 (police), 118/119 (ambulance)',
    language: 'Bahasa Indonesia; English in business settings',
    tipping_culture: '5-10% at restaurants if no service charge',
  },
  bangkok: {
    city: 'Bangkok',
    country: 'Thailand',
    timezone: 'Asia/Bangkok',
    utc_offset: 'UTC+7',
    currency: 'THB',
    currency_symbol: '฿',
    exchange_rate_note: 'Check XE.com for latest rates',
    plug_type: 'Type A / B / C (US or European 2-pin)',
    voltage: '220V / 50Hz',
    transport_tips: [
      'BTS Skytrain and MRT subway cover central Bangkok well',
      'Grab is the main ride-hailing app',
      'Tuk-tuks are fun but always negotiate the price upfront',
      'River boats (Chao Phraya Express) are useful for riverside destinations',
    ],
    emergency_number: '191 (police), 1669 (ambulance)',
    language: 'Thai; English in tourist areas and business',
    tipping_culture: 'Not mandatory — small tips at restaurants appreciated',
  },
  manila: {
    city: 'Manila',
    country: 'Philippines',
    timezone: 'Asia/Manila',
    utc_offset: 'UTC+8',
    currency: 'PHP',
    currency_symbol: '₱',
    exchange_rate_note: 'Check XE.com for latest rates',
    plug_type: 'Type A / B (US-style, 2-pin flat)',
    voltage: '220V / 60Hz',
    transport_tips: [
      'Grab is the main ride-hailing app',
      'Manila MRT/LRT covers key corridors but gets very crowded',
      'Traffic is notorious — allow 2-3x normal travel time estimates',
      'Angkas (motorcycle taxi) is an option for beating traffic',
    ],
    emergency_number: '911',
    language: 'Filipino, English widely spoken',
    tipping_culture: '10% at restaurants; small tips for services',
  },
  'ho chi minh': {
    city: 'Ho Chi Minh City',
    country: 'Vietnam',
    timezone: 'Asia/Ho_Chi_Minh',
    utc_offset: 'UTC+7',
    currency: 'VND',
    currency_symbol: '₫',
    exchange_rate_note: 'Check XE.com for latest rates',
    plug_type: 'Type A / C (US or European 2-pin)',
    voltage: '220V / 50Hz',
    transport_tips: [
      'Grab is the dominant ride-hailing app (car and motorbike)',
      'Metro Line 1 opened — useful for airport to city center',
      'Motorbike taxis (xe om) are fast but helmet required',
      'Crossing the street: walk steadily and traffic flows around you',
    ],
    emergency_number: '113 (police), 115 (ambulance)',
    language: 'Vietnamese; English in tourist/business areas',
    tipping_culture: 'Not expected but 5-10% appreciated at restaurants',
  },
  hanoi: {
    city: 'Hanoi',
    country: 'Vietnam',
    timezone: 'Asia/Ho_Chi_Minh',
    utc_offset: 'UTC+7',
    currency: 'VND',
    currency_symbol: '₫',
    exchange_rate_note: 'Check XE.com for latest rates',
    plug_type: 'Type A / C (US or European 2-pin)',
    voltage: '220V / 50Hz',
    transport_tips: [
      'Grab is the main ride-hailing app',
      'Bus network covers the city; route info on Google Maps',
      'Motorbike rental is popular but traffic is chaotic',
      'Old Quarter is best explored on foot',
    ],
    emergency_number: '113 (police), 115 (ambulance)',
    language: 'Vietnamese; less English than HCMC',
    tipping_culture: 'Not expected; small tips appreciated',
  },
}

// Aliases for common name variations
const CITY_ALIASES: Record<string, string> = {
  'kl': 'kuala lumpur',
  'bkk': 'bangkok',
  'mnl': 'manila',
  'hcmc': 'ho chi minh',
  'ho chi minh city': 'ho chi minh',
  'saigon': 'ho chi minh',
  'sgp': 'singapore',
  'sg': 'singapore',
  'jkt': 'jakarta',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { destination_city, destination_country, trip_id } = body

  if (!destination_city) {
    return NextResponse.json({ error: 'destination_city required' }, { status: 400 })
  }

  const normalizedCity = destination_city.toLowerCase().trim()
  const lookupKey = CITY_ALIASES[normalizedCity] || normalizedCity

  let cityCard: CityCard

  if (CITY_DATABASE[lookupKey]) {
    cityCard = { ...CITY_DATABASE[lookupKey] }
    // Override country if provided
    if (destination_country) {
      cityCard.country = destination_country
    }
  } else {
    // Return a generic card for unknown cities
    cityCard = {
      city: destination_city,
      country: destination_country || 'Unknown',
      timezone: 'Check timeanddate.com',
      utc_offset: 'Unknown',
      currency: 'Check local currency',
      currency_symbol: '',
      exchange_rate_note: 'Check XE.com for latest rates',
      plug_type: 'Check worldstandards.eu/electricity',
      voltage: 'Check before travel',
      transport_tips: [
        'Download Grab or local ride-hailing app before arrival',
        'Check Google Maps for public transit options',
        'Pre-arrange airport transfer if possible',
      ],
      emergency_number: 'Check before travel',
      language: 'Check before travel',
      tipping_culture: 'Check local customs',
    }
  }

  // If trip_id provided, store the city card on the trip record
  if (trip_id) {
    const { error: updateErr } = await supabase
      .from('trips')
      .update({ city_card: cityCard })
      .eq('id', trip_id)
      .eq('user_id', user.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  return NextResponse.json(cityCard)
}

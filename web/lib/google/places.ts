// Google Places API (New) client
// https://developers.google.com/maps/documentation/places/web-service
// Uses the same Google Cloud project (916749720756)
// Requires env var: GOOGLE_MAPS_API_KEY

const API_KEY = () => {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not set')
  return key
}

const PLACES_BASE = 'https://places.googleapis.com/v1'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PlaceResult {
  id: string
  name: string
  address: string
  rating: number
  userRatingCount: number
  priceLevel: string
  types: string[]
  openNow?: boolean
  photoUrl?: string
  googleMapsUrl: string
  location: { lat: number; lng: number }
  distanceMeters?: number
}

export interface PlaceDetails extends PlaceResult {
  reviews?: { text: string; rating: number; author: string }[]
  website?: string
  phoneNumber?: string
  openingHours?: string[]
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function buildPhotoUrl(photoName: string): string {
  return `${PLACES_BASE}/${photoName}/media?maxHeightPx=400&key=${API_KEY()}`
}

function mapPlace(place: Record<string, any>, originLat?: number, originLng?: number): PlaceResult {
  const loc = place.location || {}
  const photoName = place.photos?.[0]?.name

  let distanceMeters: number | undefined
  if (originLat !== undefined && originLng !== undefined && loc.latitude && loc.longitude) {
    distanceMeters = haversineMeters(originLat, originLng, loc.latitude, loc.longitude)
  }

  return {
    id: place.id || place.name?.split('/').pop() || '',
    name: place.displayName?.text || '',
    address: place.formattedAddress || place.shortFormattedAddress || '',
    rating: place.rating || 0,
    userRatingCount: place.userRatingCount || 0,
    priceLevel: place.priceLevel || 'PRICE_LEVEL_UNSPECIFIED',
    types: place.types || [],
    openNow: place.currentOpeningHours?.openNow ?? place.regularOpeningHours?.openNow,
    photoUrl: photoName ? buildPhotoUrl(photoName) : undefined,
    googleMapsUrl: place.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
    location: { lat: loc.latitude || 0, lng: loc.longitude || 0 },
    distanceMeters,
  }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Standard field mask for search responses
const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.types',
  'places.currentOpeningHours',
  'places.regularOpeningHours',
  'places.photos',
  'places.googleMapsUri',
  'places.location',
].join(',')

const DETAIL_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'shortFormattedAddress',
  'rating',
  'userRatingCount',
  'priceLevel',
  'types',
  'currentOpeningHours',
  'regularOpeningHours',
  'photos',
  'googleMapsUri',
  'location',
  'reviews',
  'websiteUri',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
].join(',')

// ─── Nearby Search ─────────────────────────────────────────────────────────────

export async function searchNearbyPlaces(params: {
  lat: number
  lng: number
  radiusMeters?: number
  type?: string
  keyword?: string
  maxResults?: number
}): Promise<PlaceResult[]> {
  const { lat, lng, radiusMeters = 1000, type, keyword, maxResults = 10 } = params

  const body: Record<string, any> = {
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
      },
    },
    maxResultCount: Math.min(maxResults, 20),
    rankPreference: 'DISTANCE',
  }

  // includedTypes accepts an array
  if (type) {
    body.includedTypes = [type]
  }

  // keyword goes into textQuery for nearby search (languageCode filter)
  // For Nearby Search (New), we use includedTypes + languageCode; keyword not directly supported.
  // If keyword is provided, we fall through to Text Search for better results.
  if (keyword) {
    // Nearby Search (New) does not support free-text keyword.
    // Use Text Search instead for keyword-based queries.
    const query = keyword + (type ? ` ${type}` : '')
    return searchPlacesByText({
      query: `${query} near ${lat},${lng}`,
      maxResults,
      locationBias: { lat, lng, radiusMeters },
    })
  }

  const res = await fetch(`${PLACES_BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY(),
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google Places Nearby Search failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  return (data.places || []).map((p: any) => mapPlace(p, lat, lng))
}

// ─── Text Search ───────────────────────────────────────────────────────────────

export async function searchPlacesByText(params: {
  query: string
  maxResults?: number
  locationBias?: { lat: number; lng: number; radiusMeters?: number }
}): Promise<PlaceResult[]> {
  const { query, maxResults = 10, locationBias } = params

  const body: Record<string, any> = {
    textQuery: query,
    maxResultCount: Math.min(maxResults, 20),
    languageCode: 'en',
  }

  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.lat, longitude: locationBias.lng },
        radius: locationBias.radiusMeters || 2000,
      },
    }
  }

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY(),
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google Places Text Search failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  const originLat = locationBias?.lat
  const originLng = locationBias?.lng
  return (data.places || []).map((p: any) => mapPlace(p, originLat, originLng))
}

// ─── Place Details ─────────────────────────────────────────────────────────────

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': API_KEY(),
      'X-Goog-FieldMask': DETAIL_FIELD_MASK,
    },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google Places Details failed (${res.status}): ${errText}`)
  }

  const place = await res.json()
  const base = mapPlace(place)

  return {
    ...base,
    reviews: (place.reviews || []).slice(0, 5).map((r: any) => ({
      text: r.text?.text || '',
      rating: r.rating || 0,
      author: r.authorAttribution?.displayName || 'Anonymous',
    })),
    website: place.websiteUri || undefined,
    phoneNumber: place.internationalPhoneNumber || place.nationalPhoneNumber || undefined,
    openingHours: place.currentOpeningHours?.weekdayDescriptions ||
      place.regularOpeningHours?.weekdayDescriptions || undefined,
  }
}

// ─── Geocoding ─────────────────────────────────────────────────────────────────

export async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  // Use the Geocoding API
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location + ', Singapore')}&key=${API_KEY()}`

  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json()
  const result = data.results?.[0]
  if (!result) return null

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
  }
}

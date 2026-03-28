/**
 * Structured city knowledge for Travel Brain briefings.
 * Each city contains deep local knowledge curated for business travelers.
 */

export interface CityKnowledge {
  city: string
  country: string
  timezone: string
  currency: { code: string; symbol: string; cashAdvice: string; tipping: string }
  visa: { cnPassport: string; usPassport: string; inPassport: string; general: string }
  entry: { tips: string[]; customs: string[]; prohibited: string[] }
  culture: {
    businessEtiquette: string[]
    religiousSensitivity: string
    dressCode: Record<string, string>
  }
  hotels: Array<{
    name: string
    area: string
    priceRange: string
    highlights: string
    nearestMrt: string
    runningNearby?: string
  }>
  restaurants: Array<{
    name: string
    cuisine: string
    priceRange: string
    area: string
    bestFor: string
    note: string
  }>
  runningRoutes: Array<{
    name: string
    distance: string
    description: string
    startPoint: string
  }>
  attractions: Array<{
    name: string
    duration: string
    bestTime: string
    description: string
  }>
  transport: { fromAirport: string; mrt: string; taxi: string; tips: string[] }
  emergency: { police: string; ambulance: string; fire: string; embassy: Record<string, string> }
  weather: { typical: string; rainyMonths: string; packingAdvice: string }
  connectivity: { simCard: string; wifi: string; vpn: string }
  powerSocket: string
}

// ---------------------------------------------------------------------------
// Singapore
// ---------------------------------------------------------------------------

export const SINGAPORE_DATA: CityKnowledge = {
  city: 'Singapore',
  country: 'Singapore',
  timezone: 'Asia/Singapore (UTC+8)',

  currency: {
    code: 'SGD',
    symbol: 'S$',
    cashAdvice:
      'Credit cards (Visa/Mastercard) accepted almost everywhere. PayNow QR is widely used. Keep S$50-100 cash for hawker centres and older shops.',
    tipping:
      'Tipping is NOT expected. Most restaurants include 10% service charge + 9% GST in the bill. Rounding up is appreciated but not required.',
  },

  visa: {
    cnPassport:
      'China passport holders enjoy visa-free entry for up to 30 days (since 2024). Must hold passport valid for at least 6 months.',
    usPassport:
      'US passport holders enjoy visa-free entry for up to 90 days. Must hold passport valid for at least 6 months.',
    inPassport:
      'India passport holders require a visa. Apply via the Singapore e-Visa portal (ICA) at least 5 business days before travel. Transit visa exemption available for certain onward destinations.',
    general:
      'SG Arrival Card (SGAC) must be submitted electronically within 3 days before arrival at https://eservices.ica.gov.sg/sgarrivalcard/. This replaces the old paper disembarkation card.',
  },

  entry: {
    tips: [
      'Submit SG Arrival Card (SGAC) online before arrival - mandatory since 2024',
      'Immigration queues at Changi are typically under 15 minutes with automated e-gates',
      'Duty-free allowance: 1L spirits, 1L wine, 1L beer per adult',
      'Declare cash over S$20,000 equivalent',
    ],
    customs: [
      'Cigarettes have NO duty-free allowance - every single stick is taxable',
      'All prescription medicines must be accompanied by a doctor letter',
      'Food items may require SFA permits - no fresh fruits/vegetables without approval',
    ],
    prohibited: [
      'Chewing gum (import, sale, and distribution are illegal; therapeutic gum from pharmacies only)',
      'E-cigarettes and vape devices (including pods and refills) - heavy fines and confiscation',
      'Controlled drugs carry extremely severe penalties including mandatory death penalty',
      'Firecrackers and fireworks',
      'Pirated media and publications',
    ],
  },

  culture: {
    businessEtiquette: [
      'Exchange business cards with both hands and study the card briefly before putting it away',
      'Address people by their title and surname until invited to use first names',
      'Punctuality is critical - arrive 5 minutes early for business meetings',
      'Multi-racial society: be mindful when scheduling over Ramadan, Deepavali, or Chinese New Year',
      'Lunch meetings are common (12:00-13:30). Dinner meetings less formal, often at restaurants',
      '"Singlish" is common in casual settings but business English is standard',
      'Hierarchy matters - address the most senior person first in group meetings',
    ],
    religiousSensitivity:
      'Singapore is multi-racial (Chinese 74%, Malay 13%, Indian 9%). Respect all religions. Remove shoes before entering mosques and Hindu temples. Cover shoulders and knees at religious sites. During Ramadan, be discreet about eating in front of Muslim colleagues.',
    dressCode: {
      general: 'Smart casual is the norm for most business settings - collared shirt, long pants, closed shoes',
      finance: 'Full business attire (suit and tie) expected at banks, insurance companies, and fund managers in the CBD',
      tech: 'Smart casual to casual. Polo shirts and chinos are common. Startups trend more casual',
      government: 'Business formal for meetings with government officials and statutory boards',
      dining: 'Smart casual for most restaurants. Fine dining may require long pants and closed shoes for men',
      outdoor: 'Light, breathable fabrics. Sunscreen is essential. Carry a light rain jacket or umbrella always',
    },
  },

  hotels: [
    {
      name: 'Marina Bay Sands',
      area: 'Marina Bay',
      priceRange: 'S$600-1,500/night',
      highlights:
        'Iconic rooftop infinity pool (guests only). Direct access to convention centre and The Shoppes. Casino on-site. SkyPark observation deck.',
      nearestMrt: 'Bayfront MRT (CE1/DT16) - 2 min walk',
      runningNearby: 'Marina Bay waterfront loop starts at the hotel doorstep',
    },
    {
      name: 'Raffles Hotel',
      area: 'City Hall / Civic District',
      priceRange: 'S$800-2,500/night',
      highlights:
        'Historic luxury since 1887. Home of the original Singapore Sling at Long Bar. All-suite property after 2019 restoration. Writers Bar is excellent for quiet business drinks.',
      nearestMrt: 'City Hall MRT (NS25/EW13) - 5 min walk',
      runningNearby: 'Fort Canning Park (1km away) has shaded trails',
    },
    {
      name: 'The Fullerton Hotel',
      area: 'Fullerton / Boat Quay',
      priceRange: 'S$400-900/night',
      highlights:
        'Converted from the historic General Post Office (1928). Rooftop infinity pool overlooking Marina Bay. The Courtyard is a popular meeting spot. Walking distance to CBD financial district.',
      nearestMrt: 'Raffles Place MRT (NS26/EW14) - 3 min walk',
      runningNearby: 'Marina Bay loop accessible via Merlion Park next door',
    },
    {
      name: 'Pan Pacific Singapore',
      area: 'Marina Centre',
      priceRange: 'S$300-700/night',
      highlights:
        'Connected to Millenia Walk shopping. Recently renovated Pacific Club Lounge. Excellent for Suntec Convention Centre access (5 min walk). Solid business hotel.',
      nearestMrt: 'Promenade MRT (CC4/DT15) - 5 min walk',
      runningNearby: 'Gardens by the Bay loop (2km away)',
    },
    {
      name: 'Shangri-La Singapore',
      area: 'Orchard / Orange Grove',
      priceRange: 'S$400-1,000/night',
      highlights:
        'Set in 15 acres of tropical gardens. Three wings: Tower, Valley, Garden. Preferred hotel for diplomats and heads of state (near embassies). Shang Palace serves excellent Cantonese.',
      nearestMrt: 'Orchard MRT (NS22) - 10 min walk or free shuttle',
      runningNearby: 'Singapore Botanic Gardens is a 5-minute walk',
    },
  ],

  restaurants: [
    {
      name: 'Tian Tian Hainanese Chicken Rice',
      cuisine: 'Hawker - Hainanese Chicken Rice',
      priceRange: 'S$5-8',
      area: 'Maxwell Food Centre, Chinatown',
      bestFor: 'Authentic local experience. Must-try for first-time visitors.',
      note: 'Queue can be 30-45 min during lunch peak. Closed Mondays. Cash only. Get there by 11am for shorter wait.',
    },
    {
      name: 'Song Fa Bak Kut Teh',
      cuisine: 'Hawker - Pork Bone Tea (Bak Kut Teh)',
      priceRange: 'S$8-15',
      area: 'New Bridge Road, Chinatown (flagship)',
      bestFor: 'Peppery Teochew-style pork rib soup. Great for rainy day comfort food.',
      note: 'Multiple outlets across Singapore. New Bridge Road is the original. Opens 9am for breakfast.',
    },
    {
      name: 'Burnt Ends',
      cuisine: 'Modern Australian BBQ',
      priceRange: 'S$200-350/person',
      area: 'Dempsey Hill',
      bestFor: 'Client entertainment. One Michelin star. Counter seating facing the custom wood-fired oven.',
      note: 'Reservations essential - book 2-3 weeks ahead. No walk-ins. Closed Sundays.',
    },
    {
      name: 'Odette',
      cuisine: 'Modern French Fine Dining',
      priceRange: 'S$350-450/person',
      area: 'National Gallery, City Hall',
      bestFor: 'High-stakes client dinner. Three Michelin stars. Consistently ranked in Asia Top 50.',
      note: 'Smart dress code enforced. Book 3-4 weeks ahead. Lunch is slightly more accessible.',
    },
    {
      name: 'Imperial Treasure Super Peking Duck',
      cuisine: 'Chinese - Cantonese / Peking',
      priceRange: 'S$80-150/person',
      area: 'Paragon, Orchard Road',
      bestFor: 'Business dinner with Chinese clients. One Michelin star. The Peking duck is carved tableside.',
      note: 'Book 3-5 days ahead for weekend dinner. Multiple outlets but Paragon is the flagship.',
    },
    {
      name: 'Hashida Sushi',
      cuisine: 'Japanese - Omakase',
      priceRange: 'S$300-500/person',
      area: 'Mandarin Gallery, Orchard',
      bestFor: 'Japanese client entertainment. Intimate counter seating. Fish flown in from Tsukiji.',
      note: 'Lunch omakase (~S$180) is better value. Reservations required. Closed Sundays.',
    },
    {
      name: 'MTR 1924',
      cuisine: 'South Indian Vegetarian',
      priceRange: 'S$12-25/person',
      area: 'Syed Alwi Road, Little India',
      bestFor: 'Authentic masala dosa and thali. Great for vegetarian colleagues.',
      note: 'Heritage brand from Bangalore since 1924. No alcohol. Can get crowded on weekends.',
    },
    {
      name: 'Hajah Maimunah',
      cuisine: 'Malay - Nasi Padang',
      priceRange: 'S$8-15/person',
      area: 'Jalan Pisang, near Arab Street',
      bestFor: 'Best nasi padang in Singapore. Halal. Perfect for understanding Malay cuisine.',
      note: 'Lunch only (closes ~3pm or when food runs out). Go before 12pm. One Michelin Bib Gourmand.',
    },
    {
      name: 'Lau Pa Sat',
      cuisine: 'Hawker Centre - Mixed',
      priceRange: 'S$5-15',
      area: 'Raffles Quay, CBD',
      bestFor: 'Quick lunch in the financial district. Satay street opens at 7pm with grilled skewers under the stars.',
      note: 'Touristy but convenient for CBD meetings. The satay stalls on Boon Tat Street in the evening are the highlight.',
    },
    {
      name: 'Candlenut',
      cuisine: 'Modern Peranakan',
      priceRange: 'S$80-120/person',
      area: 'Dempsey Hill',
      bestFor: 'Unique local fine dining. World\'s first Michelin-starred Peranakan restaurant.',
      note: 'Tasting menu showcases Straits Chinese heritage. Buah keluak dishes are the signature. Book 1 week ahead.',
    },
  ],

  runningRoutes: [
    {
      name: 'Marina Bay Waterfront Loop',
      distance: '5 km',
      description:
        'Flat, scenic loop around Marina Bay. Pass the Merlion, Esplanade, Marina Bay Sands, and Gardens by the Bay. Well-lit and safe at all hours. Paved path the entire way. Best run in Singapore for visitors.',
      startPoint: 'Merlion Park (near Fullerton Hotel)',
    },
    {
      name: 'Singapore Botanic Gardens',
      distance: '3 km (inner loop)',
      description:
        'UNESCO World Heritage Site. Shaded trails through tropical gardens. Relatively hilly with gentle slopes. The Rainforest trail adds variety. Swan Lake and Eco-Lake are good landmarks. Opens at 5am.',
      startPoint: 'Tanglin Gate (near Shangri-La Hotel)',
    },
    {
      name: 'East Coast Park',
      distance: '10 km (one way, Bedok to Marina East)',
      description:
        'Long, flat coastal path popular with serious runners. Sea breeze keeps it cooler. Multiple water stations and toilets along the way. Can extend to 15km+ connecting to Gardens by the Bay via the Marina Bay East connector.',
      startPoint: 'East Coast Park Car Park C2 (near Bedok)',
    },
  ],

  attractions: [
    {
      name: 'Gardens by the Bay',
      duration: '2-3 hours',
      bestTime: 'Evening (Supertree light show at 7:45pm and 8:45pm)',
      description:
        'Iconic Supertrees, Cloud Forest, and Flower Dome. Outdoor gardens are free. Conservatory tickets ~S$32. The OCBC Skyway between Supertrees is worth the extra S$14.',
    },
    {
      name: 'National Gallery Singapore',
      duration: '2-3 hours',
      bestTime: 'Weekday morning for fewer crowds',
      description:
        'World\'s largest public collection of Southeast Asian art. Housed in the former Supreme Court and City Hall buildings. Rooftop bar (Smoke & Mirrors) has excellent views of the Padang.',
    },
    {
      name: 'Chinatown Heritage Centre',
      duration: '1-1.5 hours',
      bestTime: 'Morning, then explore Chinatown for lunch',
      description:
        'Immersive walk-through of early Chinese immigrant life. Located on Pagoda Street. Combine with a visit to the Buddha Tooth Relic Temple and Maxwell Food Centre.',
    },
    {
      name: 'Kampong Glam / Arab Street',
      duration: '1-2 hours',
      bestTime: 'Late afternoon into evening',
      description:
        'Historic Malay-Arab quarter. Sultan Mosque, Haji Lane boutiques, and excellent Middle Eastern restaurants. Great for a post-meeting stroll.',
    },
  ],

  transport: {
    fromAirport:
      'Changi Airport to CBD: MRT (East-West Line, ~30 min, S$2.20), taxi (~25 min, S$25-40 with surcharges), Grab car (~S$20-35). MRT runs 5:30am-midnight.',
    mrt: 'MRT is the backbone - 6 lines cover all major areas. Use a contactless Visa/Mastercard or get an EZ-Link card (S$10 with S$5 stored value). Trains run every 2-5 minutes during peak hours.',
    taxi: 'Grab (Southeast Asian Uber) is the primary ride-hailing app. Download before arrival. GOJEK is the alternative. Metered taxis are also reliable. CBD surcharge applies during peak hours.',
    tips: [
      'Download the Grab app before departure - it works for rides, food delivery, and payments',
      'MRT closes at midnight; after that, taxi/Grab are the only options (night surcharge applies)',
      'No eating or drinking on MRT trains or stations - S$500 fine',
      'ERP (Electronic Road Pricing) charges apply during peak hours in the CBD - this affects taxi fares',
      'Google Maps works well for MRT routing. CityMapper app also popular locally',
    ],
  },

  emergency: {
    police: '999',
    ambulance: '995',
    fire: '995',
    embassy: {
      china: 'Embassy of China: 150 Tanglin Road, +65 6471 2117',
      usa: 'US Embassy: 27 Napier Road, +65 6476 9100',
      india: 'High Commission of India: 31 Grange Road, +65 6737 6777',
      uk: 'British High Commission: 100 Tanglin Road, +65 6424 4200',
      australia: 'Australian High Commission: 25 Napier Road, +65 6836 4100',
    },
  },

  weather: {
    typical:
      'Tropical climate: 25-33C year-round with high humidity (80-90%). Daily afternoon thunderstorms are common and usually last 30-60 minutes.',
    rainyMonths:
      'Heaviest rainfall November-January (Northeast Monsoon). June-September slightly drier but still expect rain.',
    packingAdvice:
      'Pack light, breathable fabrics. Always carry a compact umbrella or rain jacket. Indoor spaces are heavily air-conditioned (often 18-22C) - bring a light layer for offices and malls. Sunscreen SPF50 for outdoor activities.',
  },

  connectivity: {
    simCard:
      'Tourist SIM cards available at Changi Airport arrivals: Singtel hi!Tourist (S$15 for 100GB/14 days), StarHub Travel SIM (S$12 for 30GB/7 days). 4G/5G coverage is excellent island-wide.',
    wifi: 'Free WiFi widely available: Wireless@SG (government), most cafes, hotels, and malls. Speed is generally good (30-100 Mbps).',
    vpn: 'No internet censorship. All major sites and services (Google, WhatsApp, social media) work without VPN. This is a notable advantage over some neighboring countries.',
  },

  powerSocket: 'Type G (British 3-pin, 230V/50Hz). Same as UK/Hong Kong. Bring a universal adapter if coming from US/EU/China. Most hotels provide adapters on request.',
}

// ---------------------------------------------------------------------------
// City registry - add more cities here as data becomes available
// ---------------------------------------------------------------------------

export const CITY_KNOWLEDGE_REGISTRY: Record<string, CityKnowledge> = {
  singapore: SINGAPORE_DATA,
}

// Hand-picked Singapore gems that Google might not surface at the top.
// Used as fallback when Google Places API is unavailable, and for "Chief's Picks" section.

export interface CuratedPlace {
  name: string
  address: string
  area: string // CBD, Orchard, Marina Bay, etc.
  category: 'breakfast' | 'coffee' | 'lunch' | 'dinner' | 'drinks' | 'snack'
  priceRange: '$' | '$$' | '$$$' | '$$$$'
  tags: string[] // halal, business, outdoor, quiet, fast, etc.
  reason_en: string
  reason_zh: string
  googleMapsUrl: string
  location: { lat: number; lng: number }
}

export const CURATED_PLACES: CuratedPlace[] = [
  // ─── Breakfast / Brunch ────────────────────────────────────────────────────
  {
    name: 'Ya Kun Kaya Toast (Far East Square)',
    address: '18 China St, #01-01, Singapore 049560',
    area: 'CBD',
    category: 'breakfast',
    priceRange: '$',
    tags: ['fast', 'local', 'classic'],
    reason_en: 'Singapore breakfast icon. Kaya toast + soft-boiled eggs in 5 minutes.',
    reason_zh: '新加坡早餐代表，咖椰吐司配半熟蛋，5分钟搞定。',
    googleMapsUrl: 'https://www.google.com/maps/place/?q=place_id:ChIJL8P0oTgZ2jERLo9I_4u0A_Q',
    location: { lat: 1.2845, lng: 103.8492 },
  },
  {
    name: 'Tiong Bahru Bakery (Raffles Place)',
    address: '5 Shenton Way, #01-01, Singapore 068808',
    area: 'CBD',
    category: 'breakfast',
    priceRange: '$$',
    tags: ['pastry', 'coffee', 'quiet'],
    reason_en: 'Best croissants in CBD. Solid espresso. Quiet morning spot before meetings.',
    reason_zh: 'CBD最佳可颂，咖啡不错，适合会议前安静早餐。',
    googleMapsUrl: 'https://www.google.com/maps/search/Tiong+Bahru+Bakery+Raffles+Place',
    location: { lat: 1.2773, lng: 103.8530 },
  },

  // ─── Coffee ────────────────────────────────────────────────────────────────
  {
    name: 'Nylon Coffee Roasters',
    address: '4 Everton Park, #01-40, Singapore 080004',
    area: 'Tanjong Pagar',
    category: 'coffee',
    priceRange: '$$',
    tags: ['specialty', 'quiet', 'local-favorite'],
    reason_en: 'Tiny specialty roaster. Some of the best single-origin pour-over in Singapore.',
    reason_zh: '小众精品烘焙，新加坡最好的单品手冲之一。',
    googleMapsUrl: 'https://www.google.com/maps/search/Nylon+Coffee+Roasters+Everton+Park',
    location: { lat: 1.2753, lng: 103.8409 },
  },
  {
    name: 'Common Man Coffee Roasters',
    address: '22 Martin Rd, #01-00, Singapore 239058',
    area: 'Robertson Quay',
    category: 'coffee',
    priceRange: '$$',
    tags: ['spacious', 'brunch', 'wifi'],
    reason_en: 'Spacious, great for casual work meetings. Excellent flat white.',
    reason_zh: '空间宽敞，适合非正式工作会面，澳白很棒。',
    googleMapsUrl: 'https://www.google.com/maps/search/Common+Man+Coffee+Roasters+Martin+Rd',
    location: { lat: 1.2905, lng: 103.8380 },
  },
  {
    name: 'PPP Coffee (Duxton)',
    address: '28 Duxton Rd, Singapore 089494',
    area: 'Tanjong Pagar',
    category: 'coffee',
    priceRange: '$$',
    tags: ['specialty', 'quiet', 'shophouse'],
    reason_en: 'Award-winning roaster in a beautiful shophouse. Try the filter coffee.',
    reason_zh: '获奖烘焙师，店屋环境优美，试试手冲。',
    googleMapsUrl: 'https://www.google.com/maps/search/PPP+Coffee+Duxton',
    location: { lat: 1.2793, lng: 103.8436 },
  },

  // ─── Business Lunch ────────────────────────────────────────────────────────
  {
    name: 'Amoy Street Food Centre',
    address: '7 Maxwell Rd, Singapore 069111',
    area: 'CBD',
    category: 'lunch',
    priceRange: '$',
    tags: ['hawker', 'fast', 'variety'],
    reason_en: 'Best hawker centre in CBD. A Noodle Story or Coconut Club for quick power lunch.',
    reason_zh: 'CBD最佳小贩中心。A Noodle Story或椰浆饭，快速午餐首选。',
    googleMapsUrl: 'https://www.google.com/maps/search/Amoy+Street+Food+Centre',
    location: { lat: 1.2797, lng: 103.8466 },
  },
  {
    name: 'Lau Pa Sat',
    address: '18 Raffles Quay, Singapore 048582',
    area: 'CBD',
    category: 'lunch',
    priceRange: '$',
    tags: ['hawker', 'tourist-friendly', 'variety', 'satay'],
    reason_en: 'Historic hawker centre. Safe bet for entertaining overseas guests on a budget.',
    reason_zh: '历史悠久的小贩中心，接待海外客人的经济之选。',
    googleMapsUrl: 'https://www.google.com/maps/search/Lau+Pa+Sat+Singapore',
    location: { lat: 1.2806, lng: 103.8505 },
  },
  {
    name: 'PS.Cafe (Ann Siang)',
    address: '45 Ann Siang Rd, #02-02, Singapore 069719',
    area: 'CBD',
    category: 'lunch',
    priceRange: '$$$',
    tags: ['business', 'western', 'quiet', 'outdoor'],
    reason_en: 'Lush greenery, quiet enough for business conversations. Truffle fries are a must.',
    reason_zh: '绿意盎然，安静适合商务对话。松露薯条必点。',
    googleMapsUrl: 'https://www.google.com/maps/search/PS+Cafe+Ann+Siang',
    location: { lat: 1.2822, lng: 103.8463 },
  },
  {
    name: 'CUT by Wolfgang Puck',
    address: '2 Bayfront Ave, B1-71, Singapore 018972',
    area: 'Marina Bay',
    category: 'lunch',
    priceRange: '$$$$',
    tags: ['business', 'fine-dining', 'steak', 'impressive'],
    reason_en: 'Power lunch venue. When you need to close the deal over wagyu.',
    reason_zh: '商务午餐首选，和牛配合约签订。',
    googleMapsUrl: 'https://www.google.com/maps/search/CUT+Wolfgang+Puck+Marina+Bay+Sands',
    location: { lat: 1.2838, lng: 103.8591 },
  },
  {
    name: 'Meta Restaurant',
    address: '1 Keong Saik Rd, Singapore 089109',
    area: 'Tanjong Pagar',
    category: 'lunch',
    priceRange: '$$$$',
    tags: ['business', 'fine-dining', 'michelin', 'korean-french'],
    reason_en: '1-Michelin-star Korean-French fusion. Set lunch is surprisingly accessible.',
    reason_zh: '一星米其林韩法融合，套餐午餐性价比高。',
    googleMapsUrl: 'https://www.google.com/maps/search/Meta+Restaurant+Keong+Saik',
    location: { lat: 1.2800, lng: 103.8420 },
  },

  // ─── Afternoon Snack / Tea ─────────────────────────────────────────────────
  {
    name: 'TWG Tea (Marina Bay Sands)',
    address: '2 Bayfront Ave, B2-65/68, Singapore 018972',
    area: 'Marina Bay',
    category: 'snack',
    priceRange: '$$$',
    tags: ['tea', 'luxury', 'business', 'impressive'],
    reason_en: 'Impressive afternoon tea venue for client meetings. 800+ teas.',
    reason_zh: '适合客户会面的下午茶场所，800多种茶。',
    googleMapsUrl: 'https://www.google.com/maps/search/TWG+Tea+Marina+Bay+Sands',
    location: { lat: 1.2836, lng: 103.8593 },
  },
  {
    name: 'Plain Vanilla Bakery (Tiong Bahru)',
    address: '1D Yong Siak St, Singapore 168641',
    area: 'Tiong Bahru',
    category: 'snack',
    priceRange: '$$',
    tags: ['bakery', 'cupcakes', 'quiet'],
    reason_en: 'Best cupcakes in SG. Quiet neighbourhood bakery away from CBD rush.',
    reason_zh: '新加坡最佳纸杯蛋糕，远离CBD喧嚣的安静角落。',
    googleMapsUrl: 'https://www.google.com/maps/search/Plain+Vanilla+Bakery+Tiong+Bahru',
    location: { lat: 1.2847, lng: 103.8310 },
  },

  // ─── Dinner ────────────────────────────────────────────────────────────────
  {
    name: 'Burnt Ends',
    address: '7 Dempsey Rd, #01-04, Singapore 249671',
    area: 'Dempsey',
    category: 'dinner',
    priceRange: '$$$$',
    tags: ['michelin', 'bbq', 'impressive', 'reservation-needed'],
    reason_en: '1-Michelin-star modern BBQ. Hard to book, but worth it for special occasions.',
    reason_zh: '一星米其林现代烧烤，难订但值得。',
    googleMapsUrl: 'https://www.google.com/maps/search/Burnt+Ends+Dempsey',
    location: { lat: 1.3050, lng: 103.8096 },
  },
  {
    name: 'Labyrinth',
    address: '8 Raffles Ave, #02-23, Singapore 039802',
    area: 'Marina Bay',
    category: 'dinner',
    priceRange: '$$$$',
    tags: ['michelin', 'modern-singapore', 'impressive'],
    reason_en: '1-Michelin-star modern Singaporean. Reimagined local dishes. Great for impressing.',
    reason_zh: '一星米其林现代新加坡菜，重新演绎本地美食。',
    googleMapsUrl: 'https://www.google.com/maps/search/Labyrinth+Restaurant+Singapore',
    location: { lat: 1.2903, lng: 103.8561 },
  },
  {
    name: 'Jiang-Nan Chun',
    address: '190 Orchard Blvd, Singapore 248646',
    area: 'Orchard',
    category: 'dinner',
    priceRange: '$$$$',
    tags: ['chinese', 'fine-dining', 'business', 'hotel'],
    reason_en: 'Four Seasons Cantonese. Best dim sum for hosting Chinese business partners.',
    reason_zh: '四季酒店粤菜，宴请中国商务伙伴的最佳点心。',
    googleMapsUrl: 'https://www.google.com/maps/search/Jiang+Nan+Chun+Four+Seasons+Singapore',
    location: { lat: 1.3068, lng: 103.8265 },
  },
  {
    name: 'Jumbo Seafood (Riverside)',
    address: '30 Merchant Rd, #01-01/02, Singapore 058282',
    area: 'Clarke Quay',
    category: 'dinner',
    priceRange: '$$$',
    tags: ['seafood', 'chilli-crab', 'tourist-friendly', 'outdoor'],
    reason_en: 'Iconic chilli crab by the river. Crowd-pleaser for visitors and team dinners.',
    reason_zh: '河畔经典辣椒蟹，适合招待访客和团队聚餐。',
    googleMapsUrl: 'https://www.google.com/maps/search/Jumbo+Seafood+Riverside+Point',
    location: { lat: 1.2882, lng: 103.8442 },
  },
  {
    name: 'Candlenut',
    address: '17A Dempsey Rd, Singapore 249676',
    area: 'Dempsey',
    category: 'dinner',
    priceRange: '$$$$',
    tags: ['michelin', 'peranakan', 'impressive'],
    reason_en: 'World\'s first Michelin-starred Peranakan restaurant. Unique Singapore fine dining.',
    reason_zh: '全球首家米其林娘惹餐厅，独特新加坡fine dining。',
    googleMapsUrl: 'https://www.google.com/maps/search/Candlenut+Dempsey',
    location: { lat: 1.3053, lng: 103.8100 },
  },

  // ─── Drinks / Bar ──────────────────────────────────────────────────────────
  {
    name: 'Atlas Bar',
    address: '600 North Bridge Rd, Singapore 188778',
    area: 'Bugis',
    category: 'drinks',
    priceRange: '$$$$',
    tags: ['cocktail', 'impressive', 'gin', 'art-deco'],
    reason_en: 'World\'s best bar contender. Jaw-dropping art deco interior. 1,300+ gins.',
    reason_zh: '世界最佳酒吧候选，惊艳装潢艺术内饰，1300多种金酒。',
    googleMapsUrl: 'https://www.google.com/maps/search/Atlas+Bar+Singapore',
    location: { lat: 1.2973, lng: 103.8577 },
  },
  {
    name: 'Manhattan Bar (Regent)',
    address: '1 Cuscaden Rd, Singapore 249715',
    area: 'Orchard',
    category: 'drinks',
    priceRange: '$$$$',
    tags: ['cocktail', 'impressive', 'hotel-bar'],
    reason_en: 'Consistently ranked top 10 globally. Perfect for post-dinner client drinks.',
    reason_zh: '全球前十酒吧，适合晚餐后客户小酌。',
    googleMapsUrl: 'https://www.google.com/maps/search/Manhattan+Bar+Regent+Singapore',
    location: { lat: 1.3047, lng: 103.8269 },
  },
  {
    name: 'Jigger & Pony',
    address: '165 Tanjong Pagar Rd, Singapore 088539',
    area: 'Tanjong Pagar',
    category: 'drinks',
    priceRange: '$$$',
    tags: ['cocktail', 'casual', 'fun'],
    reason_en: 'Asia\'s #1 bar. Approachable cocktails, great vibe. No pretension.',
    reason_zh: '亚洲第一酒吧，鸡尾酒易饮，氛围好，不装腔作势。',
    googleMapsUrl: 'https://www.google.com/maps/search/Jigger+Pony+Tanjong+Pagar',
    location: { lat: 1.2787, lng: 103.8437 },
  },
  {
    name: 'LeVeL33',
    address: '8 Marina Blvd, #33-01, Singapore 018981',
    area: 'Marina Bay',
    category: 'drinks',
    priceRange: '$$$',
    tags: ['craft-beer', 'view', 'impressive', 'rooftop'],
    reason_en: 'World\'s highest urban microbrewery. Stunning Marina Bay view. Craft beers on tap.',
    reason_zh: '全球最高城市精酿啤酒厂，金沙湾全景，自酿啤酒。',
    googleMapsUrl: 'https://www.google.com/maps/search/LeVeL33+Marina+Bay',
    location: { lat: 1.2806, lng: 103.8541 },
  },

  // ─── Halal Options ─────────────────────────────────────────────────────────
  {
    name: 'Hajah Maimunah',
    address: '11 Jln Pisang, Singapore 199078',
    area: 'Kampong Glam',
    category: 'lunch',
    priceRange: '$',
    tags: ['halal', 'malay', 'nasi-padang', 'local-favorite'],
    reason_en: 'Best nasi padang in Singapore. Michelin Bib Gourmand. Halal-certified.',
    reason_zh: '新加坡最佳巴东饭，米其林必比登推荐，清真认证。',
    googleMapsUrl: 'https://www.google.com/maps/search/Hajah+Maimunah+Jalan+Pisang',
    location: { lat: 1.3020, lng: 103.8590 },
  },
  {
    name: 'The Coconut Club',
    address: '6 Ann Siang Hill, Singapore 069787',
    area: 'CBD',
    category: 'lunch',
    priceRange: '$$',
    tags: ['halal-friendly', 'nasi-lemak', 'local-favorite'],
    reason_en: 'Elevated nasi lemak. Coconut rice is next-level. Short walk from Raffles Place.',
    reason_zh: '高级椰浆饭，椰香米饭惊艳，离莱佛士坊步行距离。',
    googleMapsUrl: 'https://www.google.com/maps/search/The+Coconut+Club+Ann+Siang',
    location: { lat: 1.2820, lng: 103.8462 },
  },
]

// ─── Helper to filter curated places ─────────────────────────────────────────

export function filterCuratedPlaces(params: {
  category?: string
  area?: string
  tags?: string[]
  maxResults?: number
}): CuratedPlace[] {
  let results = [...CURATED_PLACES]

  if (params.category) {
    results = results.filter(p => p.category === params.category)
  }

  if (params.area) {
    results = results.filter(p =>
      p.area.toLowerCase().includes(params.area!.toLowerCase())
    )
  }

  if (params.tags && params.tags.length > 0) {
    results = results.filter(p =>
      params.tags!.some(tag => p.tags.includes(tag))
    )
  }

  return results.slice(0, params.maxResults || 5)
}

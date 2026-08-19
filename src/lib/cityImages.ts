// Cover images for the Explore "city" tabs. Edit this map freely to set a nice
// photo per city/country. If a city isn't here, the tab falls back to a photo
// from one of its places, then a placeholder.
export const CITY_IMAGES: Record<string, string> = {
  'Tokyo': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508673/cherry-blossoms-sensoji-temple-asakusa-tokyo-japan_wjrbpb.jpg',
  'Osaka': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508518/ken-cheung-p8xPxD92T98-unsplash_hj0n1q.jpg',
  'Sapporo': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1785382685/sung-jin-cho-lvuXpa6Glc0-unsplash_fg8cq6.jpg',
  'Nagano': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1785382684/steven-diaz-Shuj-9LqHwk-unsplash_ri5kzg.jpg',
  'Beijing': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508519/di-weng-5lBGmd27OOw-unsplash_i26m7y.jpg',
  'Hongkong': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508519/boat-hong-kong_kfswe5.jpg',
  'Shanghai': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508518/edward-he-uKyzXEc2k_s-unsplash_rlmdbs.jpg',
  'Taipei': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508672/beautiful-architecture-building-taipei-city_flisiw.jpg',
  'Singapore': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781690844/jay-ang-v0BgDZTJyPY-unsplash_2_bxwbzh.jpg',
  'Shenzhen': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781690969/joshua-fernandez-dJ1TGyNr5I0-unsplash_ejo7xh.jpg',
  'Guangzhou': '/city/guangzhou.jpg',
  'Seoul': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781691226/3233_bmaf00.jpg',
}

// Cover images for the Trips dashboard cards — kept SEPARATE from the Explore
// city tabs above. Add a city here to give the trip card a different photo; any
// city not listed falls back to CITY_IMAGES so no card is ever left blank.
export const TRIP_COVER_IMAGES: Record<string, string> = {
  'Hongkong': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1783503354/5_wgntvv.jpg',
  'Tokyo': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1783503354/1_sfmg11.jpg',
  'Osaka': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1783503357/3_zasqeb.jpg',
  'Taipei': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1783503354/2_vtksjl.jpg',
  'Shanghai': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1783503356/4_knvun9.jpg',
  'Shenzhen': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1782899453/citiefront2_lbs5sq.jpg',
  'Guangzhou': '/city/guangzhou-trip.jpg',
  'Beijing': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1783503355/7_fgkenp.jpg',
  'Seoul': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1783503355/8_u0oqry.jpg',
  'Singapore': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1783503354/9_v5zwny.jpg',
}

// Cover images for the Explore "country" cards. Keyed by the CANONICAL country
// name (see canonicalCountry in countries.ts) — e.g. 'Japan', not 'ญี่ปุ่น'.
// A country without an entry here falls back to the photo of the city it has
// the most places in.
export const COUNTRY_IMAGES: Record<string, string> = {
  'China': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1785145212/travelling-china_im6r2p.jpg',
  'Japan': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1785145207/tommy-silver-cCw6KQVJnyU-unsplash_jpazah.jpg',
}

// Bespoke artwork for a shortlist filter card (Places / Food / Cafe on a
// country's "สถานที่ยอดฮิต" page), keyed `<country-slug>:<bucket>`. These
// carry their own lettering, so a card that has one drops the label and the
// dark wash and shows the artwork alone. Files live in public/filter/.
export const FILTER_CARD_ART: Record<string, string> = {
  'hong-kong:place': '/filter/hongkong-places.jpg',
  'hong-kong:food': '/filter/hongkong-food.jpg',
}

/** Every city we ship a cover photo for. Lets a caller resolve a city from a
 *  url slug without waiting for any data to load. */
export const KNOWN_CITIES: string[] = [
  ...new Set([...Object.keys(TRIP_COVER_IMAGES), ...Object.keys(CITY_IMAGES)]),
]

const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase()

/** Country-card cover. `undefined` means "no dedicated photo yet" — the caller
 *  falls back to a city photo from that country. */
export function countryImage(name: string): string | undefined {
  if (!name) return undefined
  const target = norm(name)
  const hit = Object.keys(COUNTRY_IMAGES).find((k) => norm(k) === target)
  return hit ? COUNTRY_IMAGES[hit] : undefined
}

export function cityImage(name: string): string | undefined {
  if (!name) return undefined
  const target = norm(name)
  const hit = Object.keys(CITY_IMAGES).find((k) => norm(k) === target)
  return hit ? CITY_IMAGES[hit] : undefined
}

/** Trip-card cover: prefers TRIP_COVER_IMAGES, falls back to the Explore photo. */
export function tripCoverImage(name: string): string | undefined {
  if (!name) return undefined
  const target = norm(name)
  const hit = Object.keys(TRIP_COVER_IMAGES).find((k) => norm(k) === target)
  return hit ? TRIP_COVER_IMAGES[hit] : cityImage(name)
}

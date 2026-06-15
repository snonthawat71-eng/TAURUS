// Cover images for the Explore "city" tabs. Edit this map freely to set a nice
// photo per city/country. If a city isn't here, the tab falls back to a photo
// from one of its places, then a placeholder.
export const CITY_IMAGES: Record<string, string> = {
  'Tokyo': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508673/cherry-blossoms-sensoji-temple-asakusa-tokyo-japan_wjrbpb.jpg',
  'Osaka': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508518/ken-cheung-p8xPxD92T98-unsplash_hj0n1q.jpg',
  'Beijing': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508519/di-weng-5lBGmd27OOw-unsplash_i26m7y.jpg',
  'Hongkong': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508519/boat-hong-kong_kfswe5.jpg',
  'Shanghai': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508518/edward-he-uKyzXEc2k_s-unsplash_rlmdbs.jpg',
  'Taipei': 'https://res.cloudinary.com/dgz0knsft/image/upload/v1781508672/beautiful-architecture-building-taipei-city_flisiw.jpg',
}

export function cityImage(name: string): string | undefined {
  if (!name) return undefined
  const keys = Object.keys(CITY_IMAGES)
  const hit = keys.find((k) => k.toLowerCase() === name.trim().toLowerCase())
  return hit ? CITY_IMAGES[hit] : undefined
}

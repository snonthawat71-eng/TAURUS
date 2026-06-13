// Cover images for the Explore "city" tabs. Edit this map freely to set a nice
// photo per city/country. If a city isn't here, the tab falls back to a photo
// from one of its places, then a placeholder.
export const CITY_IMAGES: Record<string, string> = {
  // 'Tokyo': 'https://your-image-url.jpg',
  // 'Osaka': 'https://your-image-url.jpg',
  // 'Beijing': 'https://your-image-url.jpg',
}

export function cityImage(name: string): string | undefined {
  return CITY_IMAGES[name] ?? CITY_IMAGES[name.trim()] ?? CITY_IMAGES[name.toLowerCase()]
}

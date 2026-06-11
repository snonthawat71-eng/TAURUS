export interface Country {
  name: string
  flag: string
}

export const COUNTRIES: Country[] = [
  { name: 'China', flag: '🇨🇳' },
  { name: 'Japan', flag: '🇯🇵' },
  { name: 'South Korea', flag: '🇰🇷' },
  { name: 'Taiwan', flag: '🇹🇼' },
  { name: 'Thailand', flag: '🇹🇭' },
  { name: 'Singapore', flag: '🇸🇬' },
  { name: 'Vietnam', flag: '🇻🇳' },
  { name: 'Hong Kong', flag: '🇭🇰' },
  { name: 'USA', flag: '🇺🇸' },
  { name: 'United Kingdom', flag: '🇬🇧' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'Italy', flag: '🇮🇹' },
]

export function countryFlag(name: string | null | undefined): string {
  if (!name) return '🌍'
  return COUNTRIES.find((c) => c.name.toLowerCase() === name.toLowerCase())?.flag ?? '🌍'
}

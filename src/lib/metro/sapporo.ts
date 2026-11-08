// Sapporo Municipal Subway (lines, official colours, stations in order) for
// transit suggestions. English names follow the City of Sapporo's own station
// list, which spells the numbers out the Japanese way — "Kita-Juni-Jo",
// "Nishi-Juitchome", "Nango-Nana-Chome" — rather than writing them as digits.
// Station numbers (N01, T19, H07…) are the ones printed on the platform signs,
// so the app can show the same roundel.
//
// The two JR lines travellers actually use from Sapporo are here too — the
// Chitose Line out to New Chitose Airport and the Hakodate Line over to Otaru
// — with JR Hokkaido's own station numbers (H01…, S01…, AP15). They are a
// different railway from the subway, so they carry the JR name.
//
// The streetcar (札幌市電) is here as well — unlike the trams in the other
// cities it is a single loop that visitors actually ride, out to the Mt. Moiwa
// ropeway. Its stops carry the SC numbers and the grey the subway map prints
// the loop in.
//
// Same shape as Taipei/Tokyo: no geometry, so there's no tappable map for
// Sapporo yet — this powers the line/station autocomplete.
interface SapporoStation { name: string; num: string }
/** `mode` marks a line that isn't a subway — it decides which travel mode the
 *  line is offered under in the route editors. Omitted = metro. */
interface SapporoLine { name: string; color: string; mode?: 'tram'; stations: SapporoStation[] }

const line = (prefix: string, names: string[]): SapporoStation[] =>
  names.map((name, i) => ({ name, num: `${prefix}${String(i + 1).padStart(2, '0')}` }))

export const SAPPORO: { match: string[]; lines: SapporoLine[] } = {
  // Otaru and Chitose ride the same two JR lines, so a place saved in either
  // town finds them without the trip having to say "Sapporo". A trip named
  // after the prefecture matches too — these are the only rails we carry for
  // Hokkaido, and without the keyword it would fall back to every Japanese
  // network, Tokyo and Osaka included.
  match: ['sapporo', 'ซัปโปโร', 'ซัปโปโร่', 'ซับโปโร', '札幌', 'otaru', 'โอตารุ', '小樽', 'chitose', 'ชิโตเสะ', '千歳', 'hokkaido', 'ฮอกไกโด', '北海道'],
  lines: [
    {
      name: 'Namboku Line',
      color: '#088002',
      stations: line('N', [
        'Asabu', 'Kita-Sanjuyo-Jo', 'Kita-Nijuyo-Jo', 'Kita-Juhachi-Jo', 'Kita-Juni-Jo', 'Sapporo', 'Odori',
        'Susukino', 'Nakajima Koen', 'Horohirabashi', 'Nakanoshima', 'Hiragishi',
        'Minami-Hiragishi', 'Sumikawa', 'Jieitai-mae', 'Makomanai',
      ]),
    },
    {
      name: 'Tozai Line',
      color: '#FF9900',
      stations: line('T', [
        'Miyanosawa', 'Hassamu-Minami', 'Kotoni', 'Nijuyonken', 'Nishi-Nijuhatchome', 'Maruyama Koen',
        'Nishi-Juhatchome', 'Nishi-Juitchome', 'Odori', 'Bus Center-mae', 'Kikusui', 'Higashi-Sapporo',
        'Shiroishi', 'Nango-Nana-Chome', 'Nango-Jusan-Chome', 'Nango-Juhatchome', 'Oyachi', 'Hibarigaoka',
        'Shin-Sapporo',
      ]),
    },
    {
      name: 'Toho Line',
      color: '#0166CC',
      stations: line('H', [
        'Sakaemachi', 'Shindo-Higashi', 'Motomachi', 'Kanjo-dori-Higashi', 'Higashi-Kuyakusho-mae',
        'Kita-Jusan-Jo-Higashi', 'Sapporo', 'Odori', 'Hosui-Susukino', 'Gakuen-mae', 'Toyohira-Koen',
        'Misono', 'Tsukisamu-Chuo', 'Fukuzumi',
      ]),
    },
    {
      // 札幌市電 — one loop, listed the way the stop numbers run. Riding the
      // other way round is the same stops in reverse, so a single ordered
      // list covers both directions.
      name: 'Sapporo Streetcar',
      color: '#B2B2B2',
      mode: 'tram',
      stations: line('SC', [
        'Nishi-Yon-Chome', 'Nishi-Hatchome', 'Chuo-Kuyakusho-mae', 'Nishi-Jugo-Chome',
        'Nishisen-Rokujo', 'Nishisen-Kujo-Asahiyama-Koen-dori', 'Nishisen-Juichijo',
        'Nishisen-Juyonjo', 'Nishisen-Jurokujo', 'Ropeway Iriguchi', 'Densha-Jigyosho-mae',
        'Chuo-Toshokan-mae', 'Ishiyama-dori', 'Higashi-Tonden-dori', 'Konan-Shogakko-mae',
        'Yamahana-Jukyujo', 'Seishu-Gakuen-mae', 'Gyokei-dori', 'Nakajima-Koen-dori',
        'Yamahana-Kujo', 'Higashi-Honganji-mae', 'Shiseikan-Shogakko-mae', 'Susukino',
        'Tanukikoji',
      ]),
    },
    {
      // 快速エアポート runs this way: the airport branch joins the main line at
      // Minami-Chitose and carries straight through to Sapporo
      name: 'JR Chitose Line',
      color: '#1ABEEE',
      stations: [
        ...line('H', [
          'Sapporo', 'Naebo', 'Shiroishi', 'Heiwa', 'Shin-Sapporo', 'Kami-Nopporo', 'Kita-Hiroshima',
          'Shimamatsu', 'Megumino', 'Eniwa', 'Sapporo Beer Teien', 'Osatsu', 'Chitose', 'Minami-Chitose',
        ]),
        { name: 'New Chitose Airport', num: 'AP15' },
      ],
    },
    {
      name: 'JR Hakodate Line',
      color: '#E50401',
      stations: line('S', [
        'Sapporo', 'Soen', 'Kotoni', 'Hassamu-Chuo', 'Hassamu', 'Inazumi-Koen', 'Teine', 'Inaho',
        'Hoshioki', 'Hoshimi', 'Zenibako', 'Asari', 'Otaru-Chikko', 'Minami-Otaru', 'Otaru',
      ]),
    },
  ],
}

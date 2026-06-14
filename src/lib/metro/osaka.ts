import type { MetroNetwork, LineStation } from './types'

// Compact helper: st(id, name, number)
const s = (id: string, name: string, num: string): LineStation => ({ id, name, num })

// Osaka Metro — ทุก "เส้นที่มีสี" (9 สาย: 8 สายใต้ดิน + New Tram/Nankō Port Town).
// สถานีเปลี่ยนสายใช้ id เดียวกันข้ามสาย (เป็น interchange). ลำดับสถานี + จุดเปลี่ยนสาย
// คือสิ่งสำคัญต่อการคำนวณเส้นทาง; พิกัดเป็นแบบ schematic ปรับได้ง่าย.
export const OSAKA: MetroNetwork = {
  id: 'osaka',
  name: 'Osaka Metro',
  match: ['osaka', 'โอซาก้า', 'โอซาก้า', 'japan', 'ญี่ปุ่น'],
  lines: [
    {
      id: 'M', name: 'Midosuji', color: '#E5171F',
      stations: [
        s('esaka', 'Esaka', 'M11'), s('higashi-mikuni', 'Higashi-Mikuni', 'M12'), s('shin-osaka', 'Shin-Osaka', 'M13'),
        s('nishinakajima', 'Nishinakajima-Minamigata', 'M14'), s('nakatsu', 'Nakatsu', 'M15'), s('umeda', 'Umeda', 'M16'),
        s('yodoyabashi', 'Yodoyabashi', 'M17'), s('hommachi', 'Hommachi', 'M18'), s('shinsaibashi', 'Shinsaibashi', 'M19'),
        s('namba', 'Namba', 'M20'), s('daikokucho', 'Daikokucho', 'M21'), s('dobutsuen-mae', 'Dobutsuen-mae', 'M22'),
        s('tennoji', 'Tennoji', 'M23'), s('showacho', 'Showacho', 'M24'), s('nishitanabe', 'Nishitanabe', 'M25'),
        s('nagai', 'Nagai', 'M26'), s('abiko', 'Abiko', 'M27'), s('kita-hanada', 'Kita-Hanada', 'M28'),
        s('shin-kanaoka', 'Shin-Kanaoka', 'M29'), s('nakamozu', 'Nakamozu', 'M30'),
      ],
    },
    {
      id: 'T', name: 'Tanimachi', color: '#6A2C8C',
      stations: [
        s('dainichi', 'Dainichi', 'T11'), s('moriguchi', 'Moriguchi', 'T12'), s('taishibashi', 'Taishibashi-Imaichi', 'T13'),
        s('sekime-takadono', 'Sekime-Takadono', 'T14'), s('noe-uchindai', 'Noe-Uchindai', 'T15'), s('miyakojima', 'Miyakojima', 'T16'),
        s('tenjimbashi-6', 'Tenjimbashisuji 6-chome', 'T17'), s('nakazakicho', 'Nakazakicho', 'T18'), s('umeda', 'Higashi-Umeda', 'T19'),
        s('minami-morimachi', 'Minami-morimachi', 'T20'), s('tenmabashi', 'Tenmabashi', 'T21'), s('tanimachi-4', 'Tanimachi 4-chome', 'T22'),
        s('tanimachi-6', 'Tanimachi 6-chome', 'T23'), s('tanimachi-9', 'Tanimachi 9-chome', 'T24'), s('shitennoji-mae', 'Shitennoji-mae Yuhigaoka', 'T25'),
        s('tennoji', 'Tennoji', 'T26'), s('abeno', 'Abeno', 'T27'), s('fuminosato', 'Fuminosato', 'T28'),
        s('tanabe', 'Tanabe', 'T29'), s('komagawa-nakano', 'Komagawa-Nakano', 'T30'), s('hirano', 'Hirano', 'T31'), s('kire-uriwari', 'Kire-Uriwari', 'T32'),
      ],
    },
    {
      id: 'Y', name: 'Yotsubashi', color: '#0078BA',
      stations: [
        s('umeda', 'Nishi-Umeda', 'Y11'), s('higobashi', 'Higobashi', 'Y12'), s('hommachi', 'Hommachi', 'Y13'),
        s('yotsubashi', 'Yotsubashi', 'Y14'), s('namba', 'Namba', 'Y15'), s('daikokucho', 'Daikokucho', 'Y16'),
        s('hanazonocho', 'Hanazonocho', 'Y17'), s('kishinosato', 'Kishinosato', 'Y18'), s('tamade', 'Tamade', 'Y19'),
        s('kitakagaya', 'Kitakagaya', 'Y20'), s('suminoekoen', 'Suminoekoen', 'Y21'),
      ],
    },
    {
      id: 'C', name: 'Chuo', color: '#009A41',
      stations: [
        s('cosmosquare', 'Cosmosquare', 'C10'), s('osakako', 'Osakako', 'C11'), s('asashiobashi', 'Asashiobashi', 'C12'),
        s('bentencho', 'Bentencho', 'C13'), s('kujo', 'Kujo', 'C14'), s('awaza', 'Awaza', 'C15'), s('hommachi', 'Hommachi', 'C16'),
        s('sakaisuji-hommachi', 'Sakaisuji-Hommachi', 'C17'), s('tanimachi-4', 'Tanimachi 4-chome', 'C18'), s('morinomiya', 'Morinomiya', 'C19'),
        s('midoribashi', 'Midoribashi', 'C20'), s('fukaebashi', 'Fukaebashi', 'C21'), s('takaida', 'Takaida', 'C22'), s('nagata', 'Nagata', 'C23'),
      ],
    },
    {
      id: 'S', name: 'Sennichimae', color: '#E5008F',
      stations: [
        s('nodahanshin', 'Nodahanshin', 'S11'), s('tamagawa', 'Tamagawa', 'S12'), s('awaza', 'Awaza', 'S13'),
        s('nishinagahori', 'Nishi-Nagahori', 'S14'), s('sakuragawa', 'Sakuragawa', 'S15'), s('namba', 'Namba', 'S16'),
        s('nippombashi', 'Nippombashi', 'S17'), s('tanimachi-9', 'Tanimachi 9-chome', 'S18'), s('tsuruhashi', 'Tsuruhashi', 'S19'), s('imazato', 'Imazato', 'S20'),
      ],
    },
    {
      id: 'K', name: 'Sakaisuji', color: '#8F5E25',
      stations: [
        s('tenjimbashi-6', 'Tenjimbashisuji 6-chome', 'K11'), s('ogimachi', 'Ogimachi', 'K12'), s('minami-morimachi', 'Minami-morimachi', 'K13'),
        s('kitahama', 'Kitahama', 'K14'), s('sakaisuji-hommachi', 'Sakaisuji-Hommachi', 'K15'), s('nagahoribashi', 'Nagahoribashi', 'K16'),
        s('nippombashi', 'Nippombashi', 'K17'), s('ebisucho', 'Ebisucho', 'K18'), s('dobutsuen-mae', 'Dobutsuen-mae', 'K19'), s('tengachaya', 'Tengachaya', 'K20'),
      ],
    },
    {
      id: 'N', name: 'Nagahori Tsurumi-ryokuchi', color: '#A9CC51',
      stations: [
        s('taisho', 'Taisho', 'N11'), s('dome-mae', 'Dome-mae Chiyozaki', 'N12'), s('awaza', 'Awaza', 'N13'),
        s('nishi-ohashi', 'Nishi-Ohashi', 'N14'), s('shinsaibashi', 'Shinsaibashi', 'N15'), s('nagahoribashi', 'Nagahoribashi', 'N16'),
        s('matsuyamachi', 'Matsuyamachi', 'N17'), s('tanimachi-6', 'Tanimachi 6-chome', 'N18'), s('tamatsukuri', 'Tamatsukuri', 'N19'),
        s('morinomiya', 'Morinomiya', 'N20'), s('osaka-business-park', 'Osaka Business Park', 'N21'), s('kyobashi', 'Kyobashi', 'N22'),
        s('gamo-4', 'Gamo 4-chome', 'N23'), s('imafuku-tsurumi', 'Imafuku-Tsurumi', 'N24'), s('yokozutsumi', 'Yokozutsumi', 'N25'),
      ],
    },
    {
      id: 'I', name: 'Imazatosuji', color: '#EE7B1A',
      stations: [
        s('itakano', 'Itakano', 'I11'), s('zuiko-4', 'Zuiko 4-chome', 'I12'), s('daido-toyosato', 'Daido-Toyosato', 'I13'),
        s('taishibashi', 'Taishibashi-Imaichi', 'I14'), s('shimizu', 'Shimizu', 'I15'), s('shinmori-furuichi', 'Shinmori-Furuichi', 'I16'),
        s('sekime-seiiku', 'Sekime-Seiiku', 'I17'), s('gamo-4', 'Gamo 4-chome', 'I18'), s('shigino', 'Shigino', 'I19'),
        s('midoribashi', 'Midoribashi', 'I20'), s('imazato', 'Imazato', 'I21'),
      ],
    },
    {
      id: 'P', name: 'Nanko Port Town (New Tram)', color: '#00A0E9',
      stations: [
        s('cosmosquare', 'Cosmosquare', 'P09'), s('trade-center', 'Trade Center-mae', 'P10'), s('nakafuto', 'Nakafuto', 'P11'),
        s('port-town-nishi', 'Port Town-nishi', 'P12'), s('port-town-higashi', 'Port Town-higashi', 'P13'), s('ferry-terminal', 'Ferry Terminal', 'P14'),
        s('nanko-higashi', 'Nanko-higashi', 'P15'), s('nanko-guchi', 'Nanko-guchi', 'P16'), s('hirabayashi', 'Hirabayashi', 'P17'),
        s('suminoekoen', 'Suminoekoen', 'P18'),
      ],
    },
  ],
  hubs: {
    // central spine
    esaka: [500, 30], 'shin-osaka': [500, 90], umeda: [500, 160], yodoyabashi: [505, 235],
    hommachi: [500, 300], shinsaibashi: [500, 360], namba: [500, 420], daikokucho: [440, 470],
    'dobutsuen-mae': [500, 520], tennoji: [540, 600], nakamozu: [560, 840],
    // tanimachi
    dainichi: [780, 40], 'tenjimbashi-6': [640, 150], 'minami-morimachi': [560, 215], tenmabashi: [580, 258],
    'tanimachi-4': [650, 300], 'tanimachi-6': [620, 360], 'tanimachi-9': [590, 420], 'kire-uriwari': [720, 560],
    // yotsubashi
    higobashi: [450, 235], yotsubashi: [450, 360], suminoekoen: [380, 660],
    // chuo (east-west)
    cosmosquare: [110, 300], awaza: [400, 320], 'sakaisuji-hommachi': [575, 300], morinomiya: [730, 330], nagata: [930, 330],
    // sennichimae (east-west)
    nodahanshin: [320, 400], nippombashi: [560, 420], imazato: [760, 420],
    // sakaisuji
    kitahama: [610, 258], nagahoribashi: [575, 360], tengachaya: [520, 600],
    // nagahori
    taisho: [350, 470], 'nishi-ohashi': [445, 360], tamatsukuri: [700, 360], kyobashi: [720, 230], yokozutsumi: [930, 200],
    // imazatosuji (far east, north-south)
    itakano: [790, 0],
  },
}

// Tokyo — Tokyo Metro (9) + Toei Subway (4) + JR East ในเขต Tokyo และปริมณฑล
// สำหรับ transit suggestions: ชื่อสาย สีทางการ รหัสสถานี และลำดับสถานี
//
// รหัสเก็บแบบไม่มีขีด (G01, JY17) ตามที่ใช้บนป้ายจริง — วงกลมบนการ์ดจะได้แยก
// "ตัวอักษร/ตัวเลข" ได้ถูก สถานีชื่อเดียวกันใช้ id เดียวกัน = จุดเปลี่ยนสาย
//
// กันออกจากไฟล์ต้นทาง 4 สาย เพราะข้อมูลขัดแย้งกันเอง: Ueno-Tokyo / Utsunomiya /
// Takasaki (ใช้รหัส JU ชุดเดียวกันแต่คนละสถานี), Sagami (門沢橋 ซ้ำ 2 แถว)
// — แก้ไม่ได้โดยไม่เดา ส่วน Negishi เก็บไว้แบบไม่มีรหัส (ดูหมายเหตุที่ตัวสาย)
// Nambu ใช้ชุดที่แก้แล้ว (JN01–JN26 ต่อเนื่อง ไม่มีสถานีซ้ำ)
// หมายเหตุ: สาย Oedo ในต้นฉบับมี Tsukishima ซ้ำที่ E17 และ E19 — คงไว้ตามต้นฉบับ
import type { MetroNetwork, LineStation } from './types'

const s = (id: string, name: string, num: string): LineStation => ({ id, name, num })

export const TOKYO: MetroNetwork = {
  id: 'tokyo',
  name: 'Tokyo',
  match: ['tokyo', 'โตเกียว', '東京', 'shinjuku', 'shibuya', 'asakusa'],
  lines: [
    {
      id: 'G-ginza-line', name: 'G Ginza Line', color: '#FF9500',
      stations: [
        s('shibuya', 'Shibuya', 'G01'), s('omotesando', 'Omotesando', 'G02'), s('gaienmae', 'Gaienmae', 'G03'),
        s('aoyama-itchome', 'Aoyama-itchome', 'G04'), s('akasaka-mitsuke', 'Akasaka-mitsuke', 'G05'), s('tameike-sanno', 'Tameike-sanno', 'G06'),
        s('toranomon', 'Toranomon', 'G07'), s('shimbashi', 'Shimbashi', 'G08'), s('ginza', 'Ginza', 'G09'),
        s('kyobashi', 'Kyobashi', 'G10'), s('nihombashi', 'Nihombashi', 'G11'), s('mitsukoshimae', 'Mitsukoshimae', 'G12'),
        s('kanda', 'Kanda', 'G13'), s('suehirocho', 'Suehirocho', 'G14'), s('ueno-hirokoji', 'Ueno-hirokoji', 'G15'),
        s('ueno', 'Ueno', 'G16'), s('inaricho', 'Inaricho', 'G17'), s('tawaramachi', 'Tawaramachi', 'G18'),
        s('asakusa', 'Asakusa', 'G19'),
      ],
    },
    {
      id: 'M-marunouchi-line', name: 'M Marunouchi Line', color: '#F62E36',
      stations: [
        s('ogikubo', 'Ogikubo', 'M01'), s('minami-asagaya', 'Minami-asagaya', 'M02'), s('shin-koenji', 'Shin-koenji', 'M03'),
        s('higashi-koenji', 'Higashi-koenji', 'M04'), s('shin-nakano', 'Shin-nakano', 'M05'), s('nakano-sakaue', 'Nakano-sakaue', 'M06'),
        s('nishi-shinjuku', 'Nishi-shinjuku', 'M07'), s('shinjuku', 'Shinjuku', 'M08'), s('shinjuku-sanchome', 'Shinjuku-sanchome', 'M09'),
        s('shinjuku-gyoemmae', 'Shinjuku-gyoemmae', 'M10'), s('yotsuya-sanchome', 'Yotsuya-sanchome', 'M11'), s('yotsuya', 'Yotsuya', 'M12'),
        s('akasaka-mitsuke', 'Akasaka-mitsuke', 'M13'), s('kokkai-gijidomae', 'Kokkai-gijidomae', 'M14'), s('kasumigaseki', 'Kasumigaseki', 'M15'),
        s('ginza', 'Ginza', 'M16'), s('tokyo', 'Tokyo', 'M17'), s('otemachi', 'Otemachi', 'M18'),
        s('awajicho', 'Awajicho', 'M19'), s('ochanomizu', 'Ochanomizu', 'M20'), s('hongo-sanchome', 'Hongo-sanchome', 'M21'),
        s('korakuen', 'Korakuen', 'M22'), s('myogadani', 'Myogadani', 'M23'), s('shin-otsuka', 'Shin-otsuka', 'M24'),
        s('ikebukuro', 'Ikebukuro', 'M25'),
      ],
    },
    {
      id: 'H-hibiya-line', name: 'H Hibiya Line', color: '#B5B5AC',
      stations: [
        s('naka-meguro', 'Naka-meguro', 'H01'), s('ebisu', 'Ebisu', 'H02'), s('hiro-o', 'Hiro-o', 'H03'),
        s('roppongi', 'Roppongi', 'H04'), s('kamiyacho', 'Kamiyacho', 'H05'), s('toranomon-hills', 'Toranomon-hills', 'H06'),
        s('kasumigaseki', 'Kasumigaseki', 'H07'), s('hibiya', 'Hibiya', 'H08'), s('ginza', 'Ginza', 'H09'),
        s('higashi-ginza', 'Higashi-ginza', 'H10'), s('tsukiji', 'Tsukiji', 'H11'), s('hatchobori', 'Hatchobori', 'H12'),
        s('kayabacho', 'Kayabacho', 'H13'), s('ningyocho', 'Ningyocho', 'H14'), s('kodemmacho', 'Kodemmacho', 'H15'),
        s('akihabara', 'Akihabara', 'H16'), s('naka-okachimachi', 'Naka-okachimachi', 'H17'), s('ueno', 'Ueno', 'H18'),
        s('iriya', 'Iriya', 'H19'), s('minowa', 'Minowa', 'H20'), s('minami-senju', 'Minami-senju', 'H21'),
        s('kita-senju', 'Kita-senju', 'H22'),
      ],
    },
    {
      id: 'T-tozai-line', name: 'T Tozai Line', color: '#009BBF',
      stations: [
        s('nakano', 'Nakano', 'T01'), s('ochiai', 'Ochiai', 'T02'), s('takadanobaba', 'Takadanobaba', 'T03'),
        s('waseda', 'Waseda', 'T04'), s('kagurazaka', 'Kagurazaka', 'T05'), s('iidabashi', 'Iidabashi', 'T06'),
        s('kudanshita', 'Kudanshita', 'T07'), s('takebashi', 'Takebashi', 'T08'), s('otemachi', 'Otemachi', 'T09'),
        s('nihombashi', 'Nihombashi', 'T10'), s('kayabacho', 'Kayabacho', 'T11'), s('monzennakacho', 'Monzennakacho', 'T12'),
        s('kiba', 'Kiba', 'T13'), s('toyocho', 'Toyocho', 'T14'), s('minami-sunamachi', 'Minami-sunamachi', 'T15'),
        s('nishi-kasai', 'Nishi-kasai', 'T16'), s('kasai', 'Kasai', 'T17'), s('urayasu', 'Urayasu', 'T18'),
        s('minami-gyotoku', 'Minami-gyotoku', 'T19'), s('gyotoku', 'Gyotoku', 'T20'), s('myoden', 'Myoden', 'T21'),
        s('baraki-nakayama', 'Baraki-nakayama', 'T22'), s('nishi-funabashi', 'Nishi-funabashi', 'T23'),
      ],
    },
    {
      id: 'C-chiyoda-line', name: 'C Chiyoda Line', color: '#00A88F',
      stations: [
        s('yoyogi-uehara', 'Yoyogi-uehara', 'C01'), s('yoyogi-koen', 'Yoyogi-koen', 'C02'), s('meiji-jingumae', 'Meiji-jingumae', 'C03'),
        s('omotesando', 'Omotesando', 'C04'), s('nogizaka', 'Nogizaka', 'C05'), s('akasaka', 'Akasaka', 'C06'),
        s('kokkai-gijidomae', 'Kokkai-gijidomae', 'C07'), s('kasumigaseki', 'Kasumigaseki', 'C08'), s('hibiya', 'Hibiya', 'C09'),
        s('nijubashimae', 'Nijubashimae', 'C10'), s('otemachi', 'Otemachi', 'C11'), s('shin-ochanomizu', 'Shin-ochanomizu', 'C12'),
        s('yushima', 'Yushima', 'C13'), s('nezu', 'Nezu', 'C14'), s('sendagi', 'Sendagi', 'C15'),
        s('nishi-nippori', 'Nishi-nippori', 'C16'), s('machiya', 'Machiya', 'C17'), s('kita-senju', 'Kita-senju', 'C18'),
      ],
    },
    {
      id: 'Y-yurakucho-line', name: 'Y Yurakucho Line', color: '#C1A2D0',
      stations: [
        s('wakoshi', 'Wakoshi', 'Y01'), s('chikatetsu-narimasu', 'Chikatetsu-narimasu', 'Y02'), s('chikatetsu-akatsuka', 'Chikatetsu-akatsuka', 'Y03'),
        s('heiwadai', 'Heiwadai', 'Y04'), s('hikawadai', 'Hikawadai', 'Y05'), s('kotake-mukaihara', 'Kotake-mukaihara', 'Y06'),
        s('senkawa', 'Senkawa', 'Y07'), s('kanamecho', 'Kanamecho', 'Y08'), s('ikebukuro', 'Ikebukuro', 'Y09'),
        s('higashi-ikebukuro', 'Higashi-ikebukuro', 'Y10'), s('gokokuji', 'Gokokuji', 'Y11'), s('edogawabashi', 'Edogawabashi', 'Y12'),
        s('iidabashi', 'Iidabashi', 'Y13'), s('ichigaya', 'Ichigaya', 'Y14'), s('kojimachi', 'Kojimachi', 'Y15'),
        s('nagatacho', 'Nagatacho', 'Y16'), s('sakuradamon', 'Sakuradamon', 'Y17'), s('yurakucho', 'Yurakucho', 'Y18'),
        s('ginza-itchome', 'Ginza-itchome', 'Y19'), s('shintomicho', 'Shintomicho', 'Y20'), s('tsukishima', 'Tsukishima', 'Y21'),
        s('toyosu', 'Toyosu', 'Y22'), s('tatsumi', 'Tatsumi', 'Y23'), s('shin-kiba', 'Shin-kiba', 'Y24'),
      ],
    },
    {
      id: 'Z-hanzomon-line', name: 'Z Hanzomon Line', color: '#8F76D6',
      stations: [
        s('shibuya', 'Shibuya', 'Z01'), s('omotesando', 'Omotesando', 'Z02'), s('aoyama-itchome', 'Aoyama-itchome', 'Z03'),
        s('nagatacho', 'Nagatacho', 'Z04'), s('hanzomon', 'Hanzomon', 'Z05'), s('kudanshita', 'Kudanshita', 'Z06'),
        s('jimbocho', 'Jimbocho', 'Z07'), s('otemachi', 'Otemachi', 'Z08'), s('mitsukoshimae', 'Mitsukoshimae', 'Z09'),
        s('suitengumae', 'Suitengumae', 'Z10'), s('kiyosumi-shirakawa', 'Kiyosumi-shirakawa', 'Z11'), s('sumiyoshi', 'Sumiyoshi', 'Z12'),
        s('kinshicho', 'Kinshicho', 'Z13'), s('oshiage', 'Oshiage', 'Z14'),
      ],
    },
    {
      id: 'N-namboku-line', name: 'N Namboku Line', color: '#00ADA9',
      stations: [
        s('meguro', 'Meguro', 'N01'), s('shirokanedai', 'Shirokanedai', 'N02'), s('shirokane-takanawa', 'Shirokane-takanawa', 'N03'),
        s('azabu-juban', 'Azabu-juban', 'N04'), s('roppongi-itchome', 'Roppongi-itchome', 'N05'), s('tameike-sanno', 'Tameike-sanno', 'N06'),
        s('nagatacho', 'Nagatacho', 'N07'), s('yotsuya', 'Yotsuya', 'N08'), s('ichigaya', 'Ichigaya', 'N09'),
        s('iidabashi', 'Iidabashi', 'N10'), s('korakuen', 'Korakuen', 'N11'), s('todaimae', 'Todaimae', 'N12'),
        s('hon-komagome', 'Hon-komagome', 'N13'), s('komagome', 'Komagome', 'N14'), s('nishigahara', 'Nishigahara', 'N15'),
        s('oji', 'Oji', 'N16'), s('oji-kamiya', 'Oji-kamiya', 'N17'), s('shimo', 'Shimo', 'N18'),
        s('akabane-iwabuchi', 'Akabane-iwabuchi', 'N19'),
      ],
    },
    {
      id: 'F-fukutoshin-line', name: 'F Fukutoshin Line', color: '#9C5E31',
      stations: [
        s('wakoshi', 'Wakoshi', 'F01'), s('chikatetsu-narimasu', 'Chikatetsu-narimasu', 'F02'), s('chikatetsu-akatsuka', 'Chikatetsu-akatsuka', 'F03'),
        s('heiwadai', 'Heiwadai', 'F04'), s('hikawadai', 'Hikawadai', 'F05'), s('kotake-mukaihara', 'Kotake-mukaihara', 'F06'),
        s('senkawa', 'Senkawa', 'F07'), s('kanamecho', 'Kanamecho', 'F08'), s('ikebukuro', 'Ikebukuro', 'F09'),
        s('zoshigaya', 'Zoshigaya', 'F10'), s('nishi-waseda', 'Nishi-waseda', 'F11'), s('higashi-shinjuku', 'Higashi-shinjuku', 'F12'),
        s('shinjuku-sanchome', 'Shinjuku-sanchome', 'F13'), s('kitasando', 'Kitasando', 'F14'), s('meiji-jingumae', 'Meiji-jingumae', 'F15'),
        s('shibuya', 'Shibuya', 'F16'),
      ],
    },
    {
      id: 'A-asakusa-line', name: 'A Asakusa Line', color: '#E85298',
      stations: [
        s('nishi-magome', 'Nishi-magome', 'A01'), s('magome', 'Magome', 'A02'), s('nakanobu', 'Nakanobu', 'A03'),
        s('togoshi', 'Togoshi', 'A04'), s('gotanda', 'Gotanda', 'A05'), s('takanawadai', 'Takanawadai', 'A06'),
        s('sengakuji', 'Sengakuji', 'A07'), s('mita', 'Mita', 'A08'), s('daimon', 'Daimon', 'A09'),
        s('shimbashi', 'Shimbashi', 'A10'), s('higashi-ginza', 'Higashi-ginza', 'A11'), s('takaracho', 'Takaracho', 'A12'),
        s('nihombashi', 'Nihombashi', 'A13'), s('ningyocho', 'Ningyocho', 'A14'), s('higashi-nihombashi', 'Higashi-nihombashi', 'A15'),
        s('asakusabashi', 'Asakusabashi', 'A16'), s('kuramae', 'Kuramae', 'A17'), s('asakusa', 'Asakusa', 'A18'),
        s('honjo-azumabashi', 'Honjo-azumabashi', 'A19'), s('oshiage', 'Oshiage', 'A20'),
      ],
    },
    {
      id: 'I-mita-line', name: 'I Mita Line', color: '#0079C2',
      stations: [
        s('meguro', 'Meguro', 'I01'), s('shirokanedai', 'Shirokanedai', 'I02'), s('shirokane-takanawa', 'Shirokane-takanawa', 'I03'),
        s('mita', 'Mita', 'I04'), s('shiba-koen', 'Shiba-koen', 'I05'), s('onarimon', 'Onarimon', 'I06'),
        s('uchisaiwaicho', 'Uchisaiwaicho', 'I07'), s('hibiya', 'Hibiya', 'I08'), s('otemachi', 'Otemachi', 'I09'),
        s('jimbocho', 'Jimbocho', 'I10'), s('suidobashi', 'Suidobashi', 'I11'), s('kasuga', 'Kasuga', 'I12'),
        s('hakusan', 'Hakusan', 'I13'), s('sengoku', 'Sengoku', 'I14'), s('sugamo', 'Sugamo', 'I15'),
        s('nishi-sugamo', 'Nishi-sugamo', 'I16'), s('shin-itabashi', 'Shin-itabashi', 'I17'), s('itabashihoncho', 'Itabashihoncho', 'I18'),
        s('motohasunuma', 'Motohasunuma', 'I19'), s('shimura-sakaue', 'Shimura-sakaue', 'I20'), s('shimura-sanchome', 'Shimura-sanchome', 'I21'),
        s('hasune', 'Hasune', 'I22'), s('nishidai', 'Nishidai', 'I23'), s('takashimadaira', 'Takashimadaira', 'I24'),
        s('shin-takashimadaira', 'Shin-takashimadaira', 'I25'), s('nishi-takashimadaira', 'Nishi-takashimadaira', 'I26'),
      ],
    },
    {
      id: 'S-shinjuku-line', name: 'S Shinjuku Line', color: '#6CBB5A',
      stations: [
        s('shinjuku', 'Shinjuku', 'S01'), s('shinjuku-sanchome', 'Shinjuku-sanchome', 'S02'), s('akebonobashi', 'Akebonobashi', 'S03'),
        s('ichigaya', 'Ichigaya', 'S04'), s('kudanshita', 'Kudanshita', 'S05'), s('jimbocho', 'Jimbocho', 'S06'),
        s('ogawamachi', 'Ogawamachi', 'S07'), s('iwamotocho', 'Iwamotocho', 'S08'), s('bakuro-yokoyama', 'Bakuro-yokoyama', 'S09'),
        s('hamacho', 'Hamacho', 'S10'), s('morishita', 'Morishita', 'S11'), s('kikukawa', 'Kikukawa', 'S12'),
        s('sumiyoshi', 'Sumiyoshi', 'S13'), s('nishi-ojima', 'Nishi-ojima', 'S14'), s('ojima', 'Ojima', 'S15'),
        s('higashi-ojima', 'Higashi-ojima', 'S16'), s('funabori', 'Funabori', 'S17'), s('ichinoe', 'Ichinoe', 'S18'),
        s('mizue', 'Mizue', 'S19'), s('shinozaki', 'Shinozaki', 'S20'), s('motoyawata', 'Motoyawata', 'S21'),
      ],
    },
    {
      id: 'E-oedo-line', name: 'E Oedo Line', color: '#B6007A',
      stations: [
        s('tochomae', 'Tochomae', 'E01'), s('shinjuku-nishiguchi', 'Shinjuku-nishiguchi', 'E02'), s('higashi-shinjuku', 'Higashi-shinjuku', 'E03'),
        s('wakamatsukawada', 'Wakamatsukawada', 'E04'), s('ushigome-yanagicho', 'Ushigome-yanagicho', 'E05'), s('ushigome-kagurazaka', 'Ushigome-kagurazaka', 'E06'),
        s('iidabashi', 'Iidabashi', 'E07'), s('kasuga', 'Kasuga', 'E08'), s('hongo-sanchome', 'Hongo-sanchome', 'E09'),
        s('ueno-okachimachi', 'Ueno-okachimachi', 'E10'), s('shin-okachimachi', 'Shin-okachimachi', 'E11'), s('kuramae', 'Kuramae', 'E12'),
        s('ryogoku', 'Ryogoku', 'E13'), s('morishita', 'Morishita', 'E14'), s('kiyosumi-shirakawa', 'Kiyosumi-shirakawa', 'E15'),
        s('monzennakacho', 'Monzennakacho', 'E16'), s('tsukishima', 'Tsukishima', 'E17'), s('kachidoki', 'Kachidoki', 'E18'),
        s('tsukishima', 'Tsukishima', 'E19'), s('shiodome', 'Shiodome', 'E20'), s('daimon', 'Daimon', 'E21'),
        s('akabanebashi', 'Akabanebashi', 'E22'), s('azabu-juban', 'Azabu-juban', 'E23'), s('roppongi', 'Roppongi', 'E24'),
        s('aoyama-itchome', 'Aoyama-itchome', 'E25'), s('kokuritsu-kyogijo', 'Kokuritsu-kyogijo', 'E26'), s('yoyogi', 'Yoyogi', 'E27'),
        s('tochomae', 'Tochomae', 'E28'),
      ],
    },
    {
      id: 'JY-yamanote-line', name: 'JY Yamanote Line', color: '#9ACD32',
      stations: [
        s('tokyo', 'Tokyo', 'JY01'), s('kanda', 'Kanda', 'JY02'), s('akihabara', 'Akihabara', 'JY03'),
        s('okachimachi', 'Okachimachi', 'JY04'), s('ueno', 'Ueno', 'JY05'), s('uguisudani', 'Uguisudani', 'JY06'),
        s('nippori', 'Nippori', 'JY07'), s('nishi-nippori', 'Nishi-Nippori', 'JY08'), s('tabata', 'Tabata', 'JY09'),
        s('komagome', 'Komagome', 'JY10'), s('sugamo', 'Sugamo', 'JY11'), s('otsuka', 'Otsuka', 'JY12'),
        s('ikebukuro', 'Ikebukuro', 'JY13'), s('mejiro', 'Mejiro', 'JY14'), s('takadanobaba', 'Takadanobaba', 'JY15'),
        s('shin-okubo', 'Shin-Okubo', 'JY16'), s('shinjuku', 'Shinjuku', 'JY17'), s('yoyogi', 'Yoyogi', 'JY18'),
        s('harajuku', 'Harajuku', 'JY19'), s('shibuya', 'Shibuya', 'JY20'), s('ebisu', 'Ebisu', 'JY21'),
        s('meguro', 'Meguro', 'JY22'), s('gotanda', 'Gotanda', 'JY23'), s('osaki', 'Osaki', 'JY24'),
        s('shinagawa', 'Shinagawa', 'JY25'), s('takanawa-gateway', 'Takanawa Gateway', 'JY26'), s('tamachi', 'Tamachi', 'JY27'),
        s('hamamatsucho', 'Hamamatsucho', 'JY28'), s('yurakucho', 'Yurakucho', 'JY29'), s('tokyo', 'Tokyo', 'JY30'),
      ],
    },
    {
      id: 'JC-chuo-rapid-line', name: 'JC Chuo Rapid Line', color: '#F15A22',
      stations: [
        s('tokyo', 'Tokyo', 'JC01'), s('kanda', 'Kanda', 'JC02'), s('ochanomizu', 'Ochanomizu', 'JC03'),
        s('yotsuya', 'Yotsuya', 'JC04'), s('shinjuku', 'Shinjuku', 'JC05'), s('nakano', 'Nakano', 'JC06'),
        s('koenji', 'Koenji', 'JC07'), s('asagaya', 'Asagaya', 'JC08'), s('ogikubo', 'Ogikubo', 'JC09'),
        s('nishi-ogikubo', 'Nishi-Ogikubo', 'JC10'), s('kichijoji', 'Kichijoji', 'JC11'), s('mitaka', 'Mitaka', 'JC12'),
        s('musashi-sakai', 'Musashi-Sakai', 'JC13'), s('higashi-koganei', 'Higashi-Koganei', 'JC14'), s('musashi-koganei', 'Musashi-Koganei', 'JC15'),
        s('kokubunji', 'Kokubunji', 'JC16'), s('nishi-kokubunji', 'Nishi-Kokubunji', 'JC17'), s('kunitachi', 'Kunitachi', 'JC18'),
        s('tachikawa', 'Tachikawa', 'JC19'), s('hino', 'Hino', 'JC20'), s('toyoda', 'Toyoda', 'JC21'),
        s('hachioji', 'Hachioji', 'JC22'), s('nishi-hachioji', 'Nishi-Hachioji', 'JC23'), s('takao', 'Takao', 'JC24'),
      ],
    },
    {
      id: 'JB-chuo-sobu-local-line', name: 'JB Chuo-Sobu Local Line', color: '#FFD400',
      stations: [
        s('mitaka', 'Mitaka', 'JB10'), s('kichijoji', 'Kichijoji', 'JB11'), s('nishi-ogikubo', 'Nishi-Ogikubo', 'JB12'),
        s('ogikubo', 'Ogikubo', 'JB13'), s('asagaya', 'Asagaya', 'JB14'), s('koenji', 'Koenji', 'JB15'),
        s('nakano', 'Nakano', 'JB16'), s('higashi-nakano', 'Higashi-Nakano', 'JB17'), s('okubo', 'Okubo', 'JB18'),
        s('shinjuku', 'Shinjuku', 'JB19'), s('yoyogi', 'Yoyogi', 'JB20'), s('sendagaya', 'Sendagaya', 'JB21'),
        s('shinanomachi', 'Shinanomachi', 'JB22'), s('yotsuya', 'Yotsuya', 'JB23'), s('ichigaya', 'Ichigaya', 'JB24'),
        s('iidabashi', 'Iidabashi', 'JB25'), s('suidobashi', 'Suidobashi', 'JB26'), s('ochanomizu', 'Ochanomizu', 'JB27'),
        s('akihabara', 'Akihabara', 'JB28'), s('asakusabashi', 'Asakusabashi', 'JB29'), s('ryogoku', 'Ryogoku', 'JB30'),
        s('kinshicho', 'Kinshicho', 'JB31'), s('kameido', 'Kameido', 'JB32'), s('hirai', 'Hirai', 'JB33'),
        s('shin-koiwa', 'Shin-Koiwa', 'JB34'), s('koiwa', 'Koiwa', 'JB35'), s('ichikawa', 'Ichikawa', 'JB36'),
        s('motoyawata', 'Motoyawata', 'JB37'), s('shimousa-nakayama', 'Shimousa-Nakayama', 'JB38'), s('nishi-funabashi', 'Nishi-Funabashi', 'JB39'),
        s('funabashi', 'Funabashi', 'JB40'), s('higashi-funabashi', 'Higashi-Funabashi', 'JB41'), s('tsudanuma', 'Tsudanuma', 'JB42'),
        s('makuhari-hongo', 'Makuhari-Hongo', 'JB43'), s('makuhari', 'Makuhari', 'JB44'), s('shin-kemigawa', 'Shin-Kemigawa', 'JB45'),
        s('inage', 'Inage', 'JB46'), s('nishi-chiba', 'Nishi-Chiba', 'JB47'), s('chiba', 'Chiba', 'JB48'),
      ],
    },
    {
      id: 'JK-keihin-tohoku-line', name: 'JK Keihin-Tohoku Line', color: '#00B2E5',
      stations: [
        s('omiya', 'Omiya', 'JK01'), s('saitama-shintoshin', 'Saitama-Shintoshin', 'JK02'), s('yono', 'Yono', 'JK03'),
        s('kita-urawa', 'Kita-Urawa', 'JK04'), s('urawa', 'Urawa', 'JK05'), s('minami-urawa', 'Minami-Urawa', 'JK06'),
        s('warabi', 'Warabi', 'JK07'), s('nishi-kawaguchi', 'Nishi-Kawaguchi', 'JK08'), s('kawaguchi', 'Kawaguchi', 'JK09'),
        s('akabane', 'Akabane', 'JK10'), s('higashi-jujo', 'Higashi-Jujo', 'JK11'), s('oji', 'Oji', 'JK12'),
        s('kami-nakazato', 'Kami-Nakazato', 'JK13'), s('tabata', 'Tabata', 'JK14'), s('nishi-nippori', 'Nishi-Nippori', 'JK15'),
        s('nippori', 'Nippori', 'JK16'), s('uguisudani', 'Uguisudani', 'JK17'), s('ueno', 'Ueno', 'JK18'),
        s('okachimachi', 'Okachimachi', 'JK19'), s('akihabara', 'Akihabara', 'JK20'), s('kanda', 'Kanda', 'JK21'),
        s('tokyo', 'Tokyo', 'JK22'), s('yurakucho', 'Yurakucho', 'JK23'), s('shimbashi', 'Shimbashi', 'JK24'),
        s('hamamatsucho', 'Hamamatsucho', 'JK25'), s('tamachi', 'Tamachi', 'JK26'), s('takanawa-gateway', 'Takanawa Gateway', 'JK27'),
        s('shinagawa', 'Shinagawa', 'JK28'), s('oimachi', 'Oimachi', 'JK29'), s('omori', 'Omori', 'JK30'),
        s('kamata', 'Kamata', 'JK31'),
      ],
    },
    {
      // สาย JR ของแท้ — แต่ไฟล์ต้นทางให้รหัส JK12–JK23 ซึ่งเป็นของ
      // Keihin-Tohoku อยู่แล้ว (คนละสถานีกัน) จึงเก็บชื่อ+ลำดับสถานีที่ถูกต้อง
      // ไว้ แต่ไม่ใส่รหัส ดีกว่าใส่รหัสผิดแล้วไปทับสายอื่น
      id: 'JK-negishi-line', name: 'JR Negishi Line', color: '#00B2E5',
      stations: [
        s('yokohama', 'Yokohama', ''), s('sakuragicho', 'Sakuragicho', ''), s('kannai', 'Kannai', ''),
        s('ishikawacho', 'Ishikawacho', ''), s('yamate', 'Yamate', ''), s('negishi', 'Negishi', ''),
        s('isogo', 'Isogo', ''), s('shin-sugita', 'Shin-Sugita', ''), s('yokodai', 'Yokodai', ''),
        s('konandai', 'Konandai', ''), s('hongodai', 'Hongodai', ''), s('ofuna', 'Ofuna', ''),
      ],
    },
    {
      id: 'JN-nambu-line', name: 'JN Nambu Line', color: '#FFD400',
      stations: [
        s('kawasaki', 'Kawasaki', 'JN01'), s('shitte', 'Shitte', 'JN02'), s('yako', 'Yako', 'JN03'),
        s('kashimada', 'Kashimada', 'JN04'), s('hirama', 'Hirama', 'JN05'), s('mukogaoka-yuen', 'Mukogaoka-Yuen', 'JN06'),
        s('musashi-kosugi', 'Musashi-Kosugi', 'JN07'), s('musashi-nakahara', 'Musashi-Nakahara', 'JN08'), s('musashi-shinjo', 'Musashi-Shinjo', 'JN09'),
        s('musashi-mizonokuchi', 'Musashi-Mizonokuchi', 'JN10'), s('tsudayama', 'Tsudayama', 'JN11'), s('kuji', 'Kuji', 'JN12'),
        s('shukugawara', 'Shukugawara', 'JN13'), s('noborito', 'Noborito', 'JN14'), s('nakanoshima', 'Nakanoshima', 'JN15'),
        s('inadazutsumi', 'Inadazutsumi', 'JN16'), s('yanokuchi', 'Yanokuchi', 'JN17'), s('inagi-naganuma', 'Inagi-Naganuma', 'JN18'),
        s('minami-tama', 'Minami-Tama', 'JN19'), s('fuchu-hommachi', 'Fuchu-Hommachi', 'JN20'), s('bubaigawara', 'Bubaigawara', 'JN21'),
        s('nishi-fu', 'Nishi-Fu', 'JN22'), s('yaho', 'Yaho', 'JN23'), s('yagawa', 'Yagawa', 'JN24'),
        s('nishi-kunitachi', 'Nishi-Kunitachi', 'JN25'), s('tachikawa', 'Tachikawa', 'JN26'),
      ],
    },
    {
      id: 'JA-saikyo-line', name: 'JA Saikyo Line', color: '#00AC9A',
      stations: [
        s('osaki', 'Osaki', 'JA01'), s('ebisu', 'Ebisu', 'JA02'), s('shibuya', 'Shibuya', 'JA03'),
        s('shinjuku', 'Shinjuku', 'JA04'), s('ikebukuro', 'Ikebukuro', 'JA05'), s('itabashi', 'Itabashi', 'JA06'),
        s('jujo', 'Jujo', 'JA07'), s('akabane', 'Akabane', 'JA08'), s('kita-akabane', 'Kita-Akabane', 'JA09'),
        s('ukimafunado', 'Ukimafunado', 'JA10'), s('toda-koen', 'Toda-Koen', 'JA11'), s('toda', 'Toda', 'JA12'),
        s('kita-toda', 'Kita-Toda', 'JA13'), s('musashi-urawa', 'Musashi-Urawa', 'JA14'), s('naka-urawa', 'Naka-Urawa', 'JA15'),
        s('minami-yono', 'Minami-Yono', 'JA16'), s('yono-hommachi', 'Yono-Hommachi', 'JA17'), s('kita-yono', 'Kita-Yono', 'JA18'),
        s('omiya', 'Omiya', 'JA19'),
      ],
    },
    {
      id: 'JS-shonan-shinjuku-line', name: 'JS Shonan-Shinjuku Line', color: '#E21F26',
      stations: [
        s('omiya', 'Omiya', 'JS01'), s('urawa', 'Urawa', 'JS02'), s('akabane', 'Akabane', 'JS03'),
        s('ikebukuro', 'Ikebukuro', 'JS04'), s('shinjuku', 'Shinjuku', 'JS05'), s('shibuya', 'Shibuya', 'JS06'),
        s('ebisu', 'Ebisu', 'JS07'), s('osaki', 'Osaki', 'JS08'), s('nishi-oi', 'Nishi-Oi', 'JS09'),
        s('musashi-kosugi', 'Musashi-Kosugi', 'JS10'), s('yokohama', 'Yokohama', 'JS11'), s('hodogaya', 'Hodogaya', 'JS12'),
        s('higashi-totsuka', 'Higashi-Totsuka', 'JS13'), s('totsuka', 'Totsuka', 'JS14'), s('ofuna', 'Ofuna', 'JS15'),
      ],
    },
    {
      id: 'JO-yokosuka-line', name: 'JO Yokosuka Line', color: '#0072BC',
      stations: [
        s('tokyo', 'Tokyo', 'JO19'), s('shimbashi', 'Shimbashi', 'JO18'), s('shinagawa', 'Shinagawa', 'JO17'),
        s('nishi-oi', 'Nishi-Oi', 'JO16'), s('musashi-kosugi', 'Musashi-Kosugi', 'JO15'), s('shin-kawasaki', 'Shin-Kawasaki', 'JO14'),
        s('yokohama', 'Yokohama', 'JO13'), s('hodogaya', 'Hodogaya', 'JO12'), s('higashi-totsuka', 'Higashi-Totsuka', 'JO11'),
        s('totsuka', 'Totsuka', 'JO10'), s('ofuna', 'Ofuna', 'JO09'), s('kita-kamakura', 'Kita-Kamakura', 'JO08'),
        s('kamakura', 'Kamakura', 'JO07'), s('zushi', 'Zushi', 'JO06'),
      ],
    },
    {
      id: 'JT-tokaido-line', name: 'JT Tokaido Line', color: '#F68B1E',
      stations: [
        s('tokyo', 'Tokyo', 'JT01'), s('shimbashi', 'Shimbashi', 'JT02'), s('shinagawa', 'Shinagawa', 'JT03'),
        s('kawasaki', 'Kawasaki', 'JT04'), s('yokohama', 'Yokohama', 'JT05'), s('totsuka', 'Totsuka', 'JT06'),
        s('ofuna', 'Ofuna', 'JT07'), s('fujisawa', 'Fujisawa', 'JT08'), s('tsujido', 'Tsujido', 'JT09'),
        s('chigasaki', 'Chigasaki', 'JT10'), s('hiratsuka', 'Hiratsuka', 'JT11'), s('oiso', 'Oiso', 'JT12'),
        s('ninomiya', 'Ninomiya', 'JT13'), s('kozu', 'Kozu', 'JT14'), s('odawara', 'Odawara', 'JT15'),
      ],
    },
    {
      id: 'JE-keiyo-line', name: 'JE Keiyo Line', color: '#C9252D',
      stations: [
        s('tokyo', 'Tokyo', 'JE01'), s('hatchobori', 'Hatchobori', 'JE02'), s('etchujima', 'Etchujima', 'JE03'),
        s('shiomi', 'Shiomi', 'JE04'), s('shin-kiba', 'Shin-Kiba', 'JE05'), s('kasai-rinkai-koen', 'Kasai-Rinkai-koen', 'JE06'),
        s('maihama', 'Maihama', 'JE07'), s('shin-urayasu', 'Shin-Urayasu', 'JE08'), s('ichikawashiohama', 'Ichikawashiohama', 'JE09'),
        s('futamatashimmachi', 'Futamatashimmachi', 'JE10'), s('nishi-funabashi', 'Nishi-Funabashi', 'JE11'), s('minami-funabashi', 'Minami-Funabashi', 'JE12'),
        s('shin-narashino', 'Shin-Narashino', 'JE13'), s('kaihin-makuhari', 'Kaihin-Makuhari', 'JE14'), s('kemigawahama', 'Kemigawahama', 'JE15'),
        s('inage-kaigan', 'Inage-Kaigan', 'JE16'), s('chiba-minato', 'Chiba-Minato', 'JE17'), s('soga', 'Soga', 'JE18'),
      ],
    },
    {
      id: 'JM-musashino-line', name: 'JM Musashino Line', color: '#F15A22',
      stations: [
        s('fuchu-hommachi', 'Fuchu-Hommachi', 'JM10'), s('kita-fuchu', 'Kita-Fuchu', 'JM11'), s('nishi-kokubunji', 'Nishi-Kokubunji', 'JM12'),
        s('shin-kodaira', 'Shin-Kodaira', 'JM13'), s('shin-akitsu', 'Shin-Akitsu', 'JM14'), s('higashi-tokorozawa', 'Higashi-Tokorozawa', 'JM15'),
        s('niiza', 'Niiza', 'JM16'), s('kita-asaka', 'Kita-Asaka', 'JM17'), s('nishi-urawa', 'Nishi-Urawa', 'JM18'),
        s('musashi-urawa', 'Musashi-Urawa', 'JM19'), s('minami-urawa', 'Minami-Urawa', 'JM20'), s('higashi-urawa', 'Higashi-Urawa', 'JM21'),
        s('higashi-kawaguchi', 'Higashi-Kawaguchi', 'JM22'), s('minami-koshigaya', 'Minami-Koshigaya', 'JM23'), s('koshigaya-laketown', 'Koshigaya-Laketown', 'JM24'),
        s('yoshikawa', 'Yoshikawa', 'JM25'), s('yoshikawaminami', 'Yoshikawaminami', 'JM26'), s('shin-misato', 'Shin-Misato', 'JM27'),
        s('misato', 'Misato', 'JM28'), s('minami-nagareyama', 'Minami-Nagareyama', 'JM29'), s('shin-matsudo', 'Shin-Matsudo', 'JM30'),
        s('shin-yahashira', 'Shin-Yahashira', 'JM31'), s('higashi-matsudo', 'Higashi-Matsudo', 'JM32'), s('ichikawa-ono', 'Ichikawa-Ono', 'JM33'),
        s('funabashihoten', 'Funabashihoten', 'JM34'), s('nishi-funabashi', 'Nishi-Funabashi', 'JM35'),
      ],
    },
    {
      id: 'JJ-joban-line-rapid', name: 'JJ Joban Line (Rapid)', color: '#3333CC',
      stations: [
        s('ueno', 'Ueno', 'JJ01'), s('nippori', 'Nippori', 'JJ02'), s('mikawashima', 'Mikawashima', 'JJ03'),
        s('minami-senju', 'Minami-Senju', 'JJ04'), s('kita-senju', 'Kita-Senju', 'JJ05'), s('matsudo', 'Matsudo', 'JJ06'),
        s('kashiwa', 'Kashiwa', 'JJ07'), s('abiko', 'Abiko', 'JJ08'), s('tennodai', 'Tennodai', 'JJ09'),
        s('toride', 'Toride', 'JJ10'),
      ],
    },
    {
      id: 'JL-joban-local-line', name: 'JL Joban Local Line', color: '#00A650',
      stations: [
        s('ayase', 'Ayase', 'JL01'), s('kameari', 'Kameari', 'JL02'), s('kanamachi', 'Kanamachi', 'JL03'),
        s('matsudo', 'Matsudo', 'JL04'), s('kita-kogane', 'Kita-Kogane', 'JL05'), s('minami-kashiwa', 'Minami-Kashiwa', 'JL06'),
        s('kashiwa', 'Kashiwa', 'JL07'), s('kita-kashiwa', 'Kita-Kashiwa', 'JL08'), s('abiko', 'Abiko', 'JL09'),
        s('tennodai', 'Tennodai', 'JL10'), s('toride', 'Toride', 'JL11'),
      ],
    },
    {
      id: 'JH-yokohama-line', name: 'JH Yokohama Line', color: '#7FC342',
      stations: [
        s('higashi-kanagawa', 'Higashi-Kanagawa', 'JH01'), s('oimachi', 'Oimachi', 'JH02'), s('kikuna', 'Kikuna', 'JH03'),
        s('shin-yokohama', 'Shin-Yokohama', 'JH04'), s('kozukue', 'Kozukue', 'JH05'), s('kamoi', 'Kamoi', 'JH06'),
        s('nakayama', 'Nakayama', 'JH07'), s('tokaichiba', 'Tokaichiba', 'JH08'), s('nagatsuta', 'Nagatsuta', 'JH09'),
        s('naruse', 'Naruse', 'JH10'), s('machida', 'Machida', 'JH11'), s('kobuchi', 'Kobuchi', 'JH12'),
        s('fuchinobe', 'Fuchinobe', 'JH13'), s('yabe', 'Yabe', 'JH14'), s('sagamihara', 'Sagamihara', 'JH15'),
        s('hashimoto', 'Hashimoto', 'JH16'),
      ],
    },
    {
      id: 'JI-tsurumi-line', name: 'JI Tsurumi Line', color: '#FFD400',
      stations: [
        s('tsurumi', 'Tsurumi', 'JI01'), s('kokudo', 'Kokudo', 'JI02'), s('tsurumi-ono', 'Tsurumi-Ono', 'JI03'),
        s('bentembashi', 'Bentembashi', 'JI04'), s('asano', 'Asano', 'JI05'), s('anzen', 'Anzen', 'JI06'),
        s('shitte', 'Shitte', 'JI07'), s('umi-shibaura', 'Umi-Shibaura', 'JI08'), s('ogimachi', 'Ogimachi', 'JI09'),
      ],
    },
    {
      id: 'JC-ome-line', name: 'JC Ome Line', color: '#F15A22',
      stations: [
        s('tachikawa', 'Tachikawa', 'JC51'), s('nishi-tachikawa', 'Nishi-Tachikawa', 'JC52'), s('higashi-nakagami', 'Higashi-Nakagami', 'JC53'),
        s('nakagami', 'Nakagami', 'JC54'), s('akishima', 'Akishima', 'JC55'), s('haijima', 'Haijima', 'JC56'),
        s('ushihama', 'Ushihama', 'JC57'), s('fussa', 'Fussa', 'JC58'), s('ozaku', 'Ozaku', 'JC59'),
        s('ome', 'Ome', 'JC60'), s('mitake', 'Mitake', 'JC61'), s('okutama', 'Okutama', 'JC62'),
      ],
    },
    {
      id: 'JC-itsukaichi-line', name: 'JC Itsukaichi Line', color: '#F15A22',
      stations: [
        s('haijima', 'Haijima', 'JC81'), s('kumagawa', 'Kumagawa', 'JC82'), s('higashi-akiru', 'Higashi-Akiru', 'JC83'),
        s('akigawa', 'Akigawa', 'JC84'), s('musashi-hikida', 'Musashi-Hikida', 'JC85'), s('musashi-masuko', 'Musashi-Masuko', 'JC86'),
        s('musashi-itsukaichi', 'Musashi-Itsukaichi', 'JC87'),
      ],
    },
    {
      id: '—-hachiko-line', name: 'Hachiko Line', color: '#A8A8A8',
      stations: [
        s('hachioji', 'Hachioji', ''), s('kita-hachioji', 'Kita-Hachioji', ''), s('komiya', 'Komiya', ''),
        s('haijima', 'Haijima', ''), s('higashi-fussa', 'Higashi-Fussa', ''), s('hakonegasaki', 'Hakonegasaki', ''),
        s('komagawa', 'Komagawa', ''),
      ],
    },
  ],
  // ใช้เป็นชุด suggestion อย่างเดียว (ยังไม่มีแผนที่แบบแตะเลือก)
  hubs: {},
}

// Singapore MRT — 6 สายที่เปิดให้บริการ (ข้อมูล ณ 27 ก.ค. 2026) สำหรับ transit
// suggestions: ชื่อสาย สีทางการของ LTA รหัสสถานี และลำดับสถานีภาษาอังกฤษ
// รวม Circle Line Stage 6 (CC30 Keppel, CC31 Cantonment, CC32 Prince Edward
// Road — เปิด 12 ก.ค. 2026) ซึ่งทำให้ Marina Bay = CC33 และ Bayfront = CC34
// (รหัสเดิม CE1/CE2 เลิกใช้แล้ว)
//
// รวมช่วงที่ยังไม่เปิดให้บริการ ณ วันที่ทำข้อมูลไว้ด้วย — TEL Stage 5 (TE30 Bedok
// South, TE31 Sungei Bedok) และ DTL3 Extension (DT36 Xilin, DT37 Sungei Bedok)
// รหัสมาจากเอกสารต้นทางโดยตรง ไม่ได้เดา; Sungei Bedok เป็นสถานีเปลี่ยนสาย
// TE↔DT จึงใช้ node เดียวกัน
// รวม LRT 3 ระบบ (Bukit Panjang / Sengkang / Punggol) และ Sentosa Express
// สถานีที่อยู่หลายสายใช้ id เดียวกัน = interchange
import type { MetroNetwork, LineStation } from './types'

const s = (id: string, name: string, num: string): LineStation => ({ id, name, num })

export const SINGAPORE: MetroNetwork = {
  id: 'singapore',
  name: 'Singapore MRT',
  match: ['singapore', 'สิงคโปร์', 'สิงคโป', '新加坡', 'changi'],
  lines: [
    {
      id: 'NS', name: 'NS North-South Line', color: '#D42E12',
      stations: [
        s('jurong-east', 'Jurong East', 'NS1'), s('bukit-batok', 'Bukit Batok', 'NS2'), s('bukit-gombak', 'Bukit Gombak', 'NS3'),
        s('choa-chu-kang', 'Choa Chu Kang', 'NS4'), s('yew-tee', 'Yew Tee', 'NS5'), s('kranji', 'Kranji', 'NS7'),
        s('marsiling', 'Marsiling', 'NS8'), s('woodlands', 'Woodlands', 'NS9'), s('admiralty', 'Admiralty', 'NS10'),
        s('sembawang', 'Sembawang', 'NS11'), s('canberra', 'Canberra', 'NS12'), s('yishun', 'Yishun', 'NS13'),
        s('khatib', 'Khatib', 'NS14'), s('yio-chu-kang', 'Yio Chu Kang', 'NS15'), s('ang-mo-kio', 'Ang Mo Kio', 'NS16'),
        s('bishan', 'Bishan', 'NS17'), s('braddell', 'Braddell', 'NS18'), s('toa-payoh', 'Toa Payoh', 'NS19'),
        s('novena', 'Novena', 'NS20'), s('newton', 'Newton', 'NS21'), s('orchard', 'Orchard', 'NS22'),
        s('somerset', 'Somerset', 'NS23'), s('dhoby-ghaut', 'Dhoby Ghaut', 'NS24'), s('city-hall', 'City Hall', 'NS25'),
        s('raffles-place', 'Raffles Place', 'NS26'), s('marina-bay', 'Marina Bay', 'NS27'), s('marina-south-pier', 'Marina South Pier', 'NS28'),
      ],
    },
    {
      id: 'EW', name: 'EW East-West Line', color: '#009645',
      stations: [
        s('pasir-ris', 'Pasir Ris', 'EW1'), s('tampines', 'Tampines', 'EW2'), s('simei', 'Simei', 'EW3'),
        s('tanah-merah', 'Tanah Merah', 'EW4'), s('bedok', 'Bedok', 'EW5'), s('kembangan', 'Kembangan', 'EW6'),
        s('eunos', 'Eunos', 'EW7'), s('paya-lebar', 'Paya Lebar', 'EW8'), s('aljunied', 'Aljunied', 'EW9'),
        s('kallang', 'Kallang', 'EW10'), s('lavender', 'Lavender', 'EW11'), s('bugis', 'Bugis', 'EW12'),
        s('city-hall', 'City Hall', 'EW13'), s('raffles-place', 'Raffles Place', 'EW14'), s('tanjong-pagar', 'Tanjong Pagar', 'EW15'),
        s('outram-park', 'Outram Park', 'EW16'), s('tiong-bahru', 'Tiong Bahru', 'EW17'), s('redhill', 'Redhill', 'EW18'),
        s('queenstown', 'Queenstown', 'EW19'), s('commonwealth', 'Commonwealth', 'EW20'), s('buona-vista', 'Buona Vista', 'EW21'),
        s('dover', 'Dover', 'EW22'), s('clementi', 'Clementi', 'EW23'), s('jurong-east', 'Jurong East', 'EW24'),
        s('chinese-garden', 'Chinese Garden', 'EW25'), s('lakeside', 'Lakeside', 'EW26'), s('boon-lay', 'Boon Lay', 'EW27'),
        s('pioneer', 'Pioneer', 'EW28'), s('joo-koon', 'Joo Koon', 'EW29'), s('gul-circle', 'Gul Circle', 'EW30'),
        s('tuas-crescent', 'Tuas Crescent', 'EW31'), s('tuas-west-road', 'Tuas West Road', 'EW32'), s('tuas-link', 'Tuas Link', 'EW33'),
        s('expo', 'Expo', 'CG1'), s('changi-airport', 'Changi Airport', 'CG2'),
      ],
    },
    {
      id: 'NE', name: 'NE North East Line', color: '#9900AA',
      stations: [
        s('harbourfront', 'HarbourFront', 'NE1'), s('outram-park', 'Outram Park', 'NE3'), s('chinatown', 'Chinatown', 'NE4'),
        s('clarke-quay', 'Clarke Quay', 'NE5'), s('dhoby-ghaut', 'Dhoby Ghaut', 'NE6'), s('little-india', 'Little India', 'NE7'),
        s('farrer-park', 'Farrer Park', 'NE8'), s('boon-keng', 'Boon Keng', 'NE9'), s('potong-pasir', 'Potong Pasir', 'NE10'),
        s('woodleigh', 'Woodleigh', 'NE11'), s('serangoon', 'Serangoon', 'NE12'), s('kovan', 'Kovan', 'NE13'),
        s('hougang', 'Hougang', 'NE14'), s('buangkok', 'Buangkok', 'NE15'), s('sengkang', 'Sengkang', 'NE16'),
        s('punggol', 'Punggol', 'NE17'), s('punggol-coast', 'Punggol Coast', 'NE18'),
      ],
    },
    {
      id: 'CC', name: 'CC Circle Line', color: '#FA9E0D',
      stations: [
        s('dhoby-ghaut', 'Dhoby Ghaut', 'CC1'), s('bras-basah', 'Bras Basah', 'CC2'), s('esplanade', 'Esplanade', 'CC3'),
        s('promenade', 'Promenade', 'CC4'), s('nicoll-highway', 'Nicoll Highway', 'CC5'), s('stadium', 'Stadium', 'CC6'),
        s('mountbatten', 'Mountbatten', 'CC7'), s('dakota', 'Dakota', 'CC8'), s('paya-lebar', 'Paya Lebar', 'CC9'),
        s('macpherson', 'MacPherson', 'CC10'), s('tai-seng', 'Tai Seng', 'CC11'), s('bartley', 'Bartley', 'CC12'),
        s('serangoon', 'Serangoon', 'CC13'), s('lorong-chuan', 'Lorong Chuan', 'CC14'), s('bishan', 'Bishan', 'CC15'),
        s('marymount', 'Marymount', 'CC16'), s('caldecott', 'Caldecott', 'CC17'), s('botanic-gardens', 'Botanic Gardens', 'CC19'),
        s('farrer-road', 'Farrer Road', 'CC20'), s('holland-village', 'Holland Village', 'CC21'), s('buona-vista', 'Buona Vista', 'CC22'),
        s('one-north', 'one-north', 'CC23'), s('kent-ridge', 'Kent Ridge', 'CC24'), s('haw-par-villa', 'Haw Par Villa', 'CC25'),
        s('pasir-panjang', 'Pasir Panjang', 'CC26'), s('labrador-park', 'Labrador Park', 'CC27'), s('telok-blangah', 'Telok Blangah', 'CC28'),
        s('harbourfront', 'HarbourFront', 'CC29'), s('keppel', 'Keppel', 'CC30'), s('cantonment', 'Cantonment', 'CC31'),
        s('prince-edward-road', 'Prince Edward Road', 'CC32'), s('marina-bay', 'Marina Bay', 'CC33'), s('bayfront', 'Bayfront', 'CC34'),
      ],
    },
    {
      id: 'DT', name: 'DT Downtown Line', color: '#0055B8',
      stations: [
        s('bukit-panjang', 'Bukit Panjang', 'DT1'), s('cashew', 'Cashew', 'DT2'), s('hillview', 'Hillview', 'DT3'),
        s('hume', 'Hume', 'DT4'), s('beauty-world', 'Beauty World', 'DT5'), s('king-albert-park', 'King Albert Park', 'DT6'),
        s('sixth-avenue', 'Sixth Avenue', 'DT7'), s('tan-kah-kee', 'Tan Kah Kee', 'DT8'), s('botanic-gardens', 'Botanic Gardens', 'DT9'),
        s('stevens', 'Stevens', 'DT10'), s('newton', 'Newton', 'DT11'), s('little-india', 'Little India', 'DT12'),
        s('rochor', 'Rochor', 'DT13'), s('bugis', 'Bugis', 'DT14'), s('promenade', 'Promenade', 'DT15'),
        s('bayfront', 'Bayfront', 'DT16'), s('downtown', 'Downtown', 'DT17'), s('telok-ayer', 'Telok Ayer', 'DT18'),
        s('chinatown', 'Chinatown', 'DT19'), s('fort-canning', 'Fort Canning', 'DT20'), s('bencoolen', 'Bencoolen', 'DT21'),
        s('jalan-besar', 'Jalan Besar', 'DT22'), s('bendemeer', 'Bendemeer', 'DT23'), s('geylang-bahru', 'Geylang Bahru', 'DT24'),
        s('mattar', 'Mattar', 'DT25'), s('macpherson', 'MacPherson', 'DT26'), s('ubi', 'Ubi', 'DT27'),
        s('kaki-bukit', 'Kaki Bukit', 'DT28'), s('bedok-north', 'Bedok North', 'DT29'), s('bedok-reservoir', 'Bedok Reservoir', 'DT30'),
        s('tampines-west', 'Tampines West', 'DT31'), s('tampines', 'Tampines', 'DT32'), s('tampines-east', 'Tampines East', 'DT33'),
        s('upper-changi', 'Upper Changi', 'DT34'), s('expo', 'Expo', 'DT35'),
        s('xilin', 'Xilin', 'DT36'), s('sungei-bedok', 'Sungei Bedok', 'DT37'),
      ],
    },
    {
      id: 'TE', name: 'TE Thomson-East Coast Line', color: '#9D5B25',
      stations: [
        s('woodlands-north', 'Woodlands North', 'TE1'), s('woodlands', 'Woodlands', 'TE2'), s('woodlands-south', 'Woodlands South', 'TE3'),
        s('springleaf', 'Springleaf', 'TE4'), s('lentor', 'Lentor', 'TE5'), s('mayflower', 'Mayflower', 'TE6'),
        s('bright-hill', 'Bright Hill', 'TE7'), s('upper-thomson', 'Upper Thomson', 'TE8'), s('caldecott', 'Caldecott', 'TE9'),
        s('stevens', 'Stevens', 'TE11'), s('napier', 'Napier', 'TE12'), s('orchard-boulevard', 'Orchard Boulevard', 'TE13'),
        s('orchard', 'Orchard', 'TE14'), s('great-world', 'Great World', 'TE15'), s('havelock', 'Havelock', 'TE16'),
        s('outram-park', 'Outram Park', 'TE17'), s('maxwell', 'Maxwell', 'TE18'), s('shenton-way', 'Shenton Way', 'TE19'),
        s('marina-bay', 'Marina Bay', 'TE20'), s('gardens-by-the-bay', 'Gardens by the Bay', 'TE22'), s('tanjong-rhu', 'Tanjong Rhu', 'TE23'),
        s('katong-park', 'Katong Park', 'TE24'), s('tanjong-katong', 'Tanjong Katong', 'TE25'), s('marine-parade', 'Marine Parade', 'TE26'),
        s('marine-terrace', 'Marine Terrace', 'TE27'), s('siglap', 'Siglap', 'TE28'), s('bayshore', 'Bayshore', 'TE29'),
        s('bedok-south', 'Bedok South', 'TE30'), s('sungei-bedok', 'Sungei Bedok', 'TE31'),
      ],
    },
    {
      // ── LRT + monorail ──────────────────────────────────────────────
      // Separate systems from the MRT above, but they share their interchange
      // stations' ids so a transfer is one physical place, not two.
      id: 'BP', name: 'BP Bukit Panjang LRT', color: '#748BC2',
      stations: [
        s('choa-chu-kang', 'Choa Chu Kang', 'BP1'), s('south-view', 'South View', 'BP2'), s('keat-hong', 'Keat Hong', 'BP3'),
        s('teck-whye', 'Teck Whye', 'BP4'), s('phoenix', 'Phoenix', 'BP5'), s('bukit-panjang', 'Bukit Panjang', 'BP6'),
        s('petir', 'Petir', 'BP7'), s('pending', 'Pending', 'BP8'), s('bangkit', 'Bangkit', 'BP9'),
        s('fajar', 'Fajar', 'BP10'), s('segar', 'Segar', 'BP11'), s('jelapang', 'Jelapang', 'BP12'),
        s('senja', 'Senja', 'BP13'),
      ],
    },
    {
      // Two loops out of Sengkang (STC): west SW1-SW8, then east SE1-SE5.
      // Listed as one line — the model has no loop concept and every station
      // keeps its own official code, which is what the picker shows.
      id: 'ST', name: 'ST Sengkang LRT', color: '#7A4FA3',
      stations: [
        s('sengkang', 'Sengkang', 'STC'), s('cheng-lim', 'Cheng Lim', 'SW1'), s('farmway', 'Farmway', 'SW2'),
        s('kupang', 'Kupang', 'SW3'), s('thanggam', 'Thanggam', 'SW4'), s('fernvale', 'Fernvale', 'SW5'),
        s('layar', 'Layar', 'SW6'), s('tongkang', 'Tongkang', 'SW7'), s('renjong', 'Renjong', 'SW8'),
        s('compassvale', 'Compassvale', 'SE1'), s('rumbia', 'Rumbia', 'SE2'), s('bakau', 'Bakau', 'SE3'),
        s('kangkar', 'Kangkar', 'SE4'), s('ranggung', 'Ranggung', 'SE5'),
      ],
    },
    {
      // Two loops out of Punggol (PTC): east PE1-PE7, then west PW1-PW7.
      id: 'PT', name: 'PT Punggol LRT', color: '#E66A2C',
      stations: [
        s('punggol', 'Punggol', 'PTC'), s('cove', 'Cove', 'PE1'), s('meridian', 'Meridian', 'PE2'),
        s('coral-edge', 'Coral Edge', 'PE3'), s('riviera', 'Riviera', 'PE4'), s('kadaloor', 'Kadaloor', 'PE5'),
        s('oasis', 'Oasis', 'PE6'), s('damai', 'Damai', 'PE7'), s('sam-kee', 'Sam Kee', 'PW1'),
        s('teck-lee', 'Teck Lee', 'PW2'), s('punggol-point', 'Punggol Point', 'PW3'), s('samudera', 'Samudera', 'PW4'),
        s('nibong', 'Nibong', 'PW5'), s('sumang', 'Sumang', 'PW6'), s('soo-teck', 'Soo Teck', 'PW7'),
      ],
    },
    {
      // Monorail to Sentosa, not part of MRT/LRT. SX1 boards at VivoCity,
      // which is the HarbourFront interchange complex — same id as NE1/CC29.
      // Colour sampled off Google Maps (line badge, route and timeline all
      // read #F29000); the source file's #00A6A6 was its own map colour, not
      // an official one, and didn't match what riders actually see.
      id: 'SX', name: 'SX Sentosa Express', color: '#F29000',
      stations: [
        s('harbourfront', 'VivoCity', 'SX1'), s('resorts-world', 'Resorts World', 'SX2'), s('imbiah', 'Imbiah', 'SX3'),
        s('beach', 'Beach', 'SX4'),
      ],
    },
  ],
  // พิกัดของทุกสถานีสำหรับวาดแผนที่แบบแตะเลือก (ดู NetworkMap)
  //
  // ที่มา: ตำแหน่งจริง (lat/lon) ของแต่ละสถานี แปลงเป็นระนาบแล้วดึงย่านใจกลาง
  // เมืองให้กางออก (fisheye) เพราะสถานีในไชน่าทาวน์/ราฟเฟิลส์อยู่ชิดกันมาก
  // จนอ่านไม่ออกถ้าวางตามสัดส่วนจริง — แผนที่รถไฟทุกเมืองก็ทำแบบนี้
  // สถานีที่ไม่มีพิกัด (เช่น Teck Lee ที่ยังไม่เปิด) build.ts จะเฉลี่ยจาก
  // สถานีข้างเคียงให้เอง
  hubs: {
    // NS North-South Line
    'jurong-east': [248, 364], 'bukit-batok': [285, 301], 'bukit-gombak': [300, 266], 'choa-chu-kang': [302, 183],
    'yew-tee': [320, 148], 'kranji': [379, 68], 'marsiling': [416, 46], 'woodlands': [453, 33],
    'admiralty': [494, 22], 'sembawang': [550, 0], 'canberra': [576, 13], 'yishun': [590, 47],
    'khatib': [582, 78], 'yio-chu-kang': [616, 172], 'ang-mo-kio': [631, 206], 'bishan': [626, 264],
    'braddell': [618, 300], 'toa-payoh': [619, 328], 'novena': [599, 376], 'newton': [565, 412],
    'orchard': [523, 460], 'somerset': [552, 480], 'dhoby-ghaut': [590, 486], 'city-hall': [639, 541],
    'raffles-place': [636, 620], 'marina-bay': [654, 660], 'marina-south-pier': [697, 683],
    // EW East-West Line
    'pasir-ris': [957, 218], 'tampines': [963, 281], 'simei': [997, 322], 'tanah-merah': [993, 383],
    'bedok': [947, 390], 'kembangan': [894, 396], 'eunos': [862, 397], 'paya-lebar': [825, 401],
    'aljunied': [787, 403], 'kallang': [742, 421], 'lavender': [704, 438], 'bugis': [669, 473],
    'tanjong-pagar': [605, 659], 'outram-park': [565, 636], 'tiong-bahru': [493, 592], 'redhill': [450, 565],
    'queenstown': [411, 533], 'commonwealth': [388, 487], 'buona-vista': [366, 464], 'dover': [334, 447],
    'clementi': [298, 434], 'chinese-garden': [231, 332], 'lakeside': [202, 329], 'boon-lay': [159, 355],
    'pioneer': [136, 362], 'joo-koon': [86, 404], 'gul-circle': [41, 439], 'tuas-crescent': [17, 435],
    'tuas-west-road': [1, 404], 'tuas-link': [0, 368], 'expo': [1028, 355], 'changi-airport': [1080, 284],
    // NE North East Line
    'harbourfront': [501, 701], 'chinatown': [587, 614], 'clarke-quay': [595, 588], 'little-india': [622, 438],
    'farrer-park': [652, 411], 'boon-keng': [688, 381], 'potong-pasir': [715, 335], 'woodleigh': [717, 307],
    'serangoon': [722, 271], 'kovan': [759, 240], 'hougang': [779, 207], 'buangkok': [776, 173],
    'sengkang': [779, 149], 'punggol': [795, 112], 'punggol-coast': [805, 87],
    // CC Circle Line
    'bras-basah': [628, 498], 'esplanade': [681, 539], 'promenade': [715, 541], 'nicoll-highway': [719, 483],
    'stadium': [773, 472], 'mountbatten': [800, 456], 'dakota': [822, 448], 'macpherson': [804, 361],
    'tai-seng': [787, 324], 'bartley': [750, 298], 'lorong-chuan': [686, 263], 'marymount': [591, 272],
    'caldecott': [587, 310], 'botanic-gardens': [475, 378], 'farrer-road': [438, 405], 'holland-village': [391, 437],
    'one-north': [352, 506], 'kent-ridge': [342, 540], 'haw-par-villa': [338, 599], 'pasir-panjang': [373, 634],
    'labrador-park': [416, 658], 'telok-blangah': [444, 670], 'keppel': [543, 679], 'cantonment': [574, 667],
    'prince-edward-road': [613, 671], 'bayfront': [686, 629],
    // DT Downtown Line
    'bukit-panjang': [348, 198], 'cashew': [348, 225], 'hillview': [350, 248], 'hume': [348, 283],
    'beauty-world': [357, 318], 'king-albert-park': [376, 337], 'sixth-avenue': [417, 351], 'tan-kah-kee': [448, 367],
    'stevens': [516, 384], 'rochor': [642, 454], 'downtown': [645, 645], 'telok-ayer': [616, 630],
    'fort-canning': [572, 549], 'bencoolen': [628, 486], 'jalan-besar': [662, 446], 'bendemeer': [697, 408],
    'geylang-bahru': [731, 376], 'mattar': [776, 358], 'ubi': [837, 351], 'kaki-bukit': [865, 335],
    'bedok-north': [897, 340], 'bedok-reservoir': [942, 339], 'tampines-west': [950, 307], 'tampines-east': [989, 275],
    'upper-changi': [1022, 331], 'xilin': [1027, 367], 'sungei-bedok': [991, 395],
    // TE Thomson-East Coast Line
    'woodlands-north': [454, 6], 'woodlands-south': [470, 56], 'springleaf': [532, 131], 'lentor': [587, 164],
    'mayflower': [587, 201], 'bright-hill': [571, 230], 'upper-thomson': [564, 255], 'napier': [471, 454],
    'orchard-boulevard': [485, 479], 'great-world': [509, 535], 'havelock': [529, 584], 'maxwell': [594, 638],
    'shenton-way': [624, 655], 'gardens-by-the-bay': [728, 639], 'tanjong-rhu': [777, 543], 'katong-park': [823, 504],
    'tanjong-katong': [860, 508], 'marine-parade': [890, 490], 'marine-terrace': [916, 470], 'siglap': [940, 442],
    'bayshore': [965, 424], 'bedok-south': [984, 413],
    // BP Bukit Panjang LRT
    'south-view': [301, 198], 'keat-hong': [310, 202], 'teck-whye': [321, 207], 'phoenix': [336, 200],
    'petir': [370, 199], 'pending': [374, 202], 'bangkit': [381, 190], 'fajar': [379, 178],
    'segar': [377, 168], 'jelapang': [361, 173], 'senja': [353, 185],
    // ST Sengkang LRT
    'cheng-lim': [772, 135], 'farmway': [757, 132], 'kupang': [733, 128], 'thanggam': [715, 130],
    'fernvale': [717, 145], 'layar': [730, 145], 'tongkang': [750, 153], 'renjong': [764, 160],
    'compassvale': [793, 141], 'rumbia': [812, 151], 'bakau': [812, 160], 'kangkar': [804, 171],
    'ranggung': [790, 171],
    // PT Punggol LRT
    'cove': [808, 129], 'meridian': [818, 136], 'coral-edge': [831, 145], 'riviera': [842, 144],
    'kadaloor': [840, 130], 'oasis': [827, 122], 'damai': [814, 113], 'sam-kee': [801, 101],
    'punggol-point': [803, 82], 'samudera': [790, 84], 'nibong': [786, 95], 'sumang': [782, 103],
    'soo-teck': [779, 111],
    // SX Sentosa Express
    'resorts-world': [502, 739], 'imbiah': [496, 747], 'beach': [513, 760],
  },
}

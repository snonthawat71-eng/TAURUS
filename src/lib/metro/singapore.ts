// Singapore MRT — 6 สายที่เปิดให้บริการ (ข้อมูล ณ 27 ก.ค. 2026) สำหรับ transit
// suggestions: ชื่อสาย สีทางการของ LTA รหัสสถานี และลำดับสถานีภาษาอังกฤษ
// รวม Circle Line Stage 6 (CC30 Keppel, CC31 Cantonment, CC32 Prince Edward
// Road — เปิด 12 ก.ค. 2026) ซึ่งทำให้ Marina Bay = CC33 และ Bayfront = CC34
// (รหัสเดิม CE1/CE2 เลิกใช้แล้ว) ไม่รวม LRT และไม่รวมช่วงที่ยังไม่เปิด
// (TEL Stage 5, DTL3 Extension) สถานีที่อยู่หลายสายใช้ id เดียวกัน = interchange
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
      ],
    },
  ],
  // ใช้เป็นชุด suggestion อย่างเดียว (ยังไม่มีแผนที่แบบแตะเลือก) — hubs ว่างไว้ได้
  hubs: {},
}

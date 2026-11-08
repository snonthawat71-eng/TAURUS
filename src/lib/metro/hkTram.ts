// Hong Kong Tramways (電車 / "ding ding") — the double-deckers along the north
// shore of Hong Kong Island. A separate railway from the MTR and ridden as a
// tram, so it is offered under รถราง rather than รถไฟฟ้า.
//
// Stops, their order and their codes come from Hong Kong Tramways' own open
// data (data.gov.hk, "Tramways Tram Stops"). The two directions do NOT mirror
// each other — the tracks run along different streets in places, so eastbound
// has stops westbound doesn't (Chun Yeung Street, Luard Road…) and the other
// way round. They are therefore two separate lines, each already in travel
// order, which is what lets the editor count the stops between two correctly.
// "T" is the code the data gives every terminus, "D" the depot.
//
// Trams are signed by destination rather than by a line name. The Transport
// Department's six published routes all run along this one corridor:
//   1. Western Market ↔ Shau Kei Wan
//   2. Happy Valley ↔ Shau Kei Wan
//   3. Shek Tong Tsui ↔ North Point
//   4. Shek Tong Tsui ↔ Causeway Bay
//   5. Kennedy Town ↔ Happy Valley
//   6. Kennedy Town ↔ Shau Kei Wan
// So: pick the direction you ride, and put the destination in the ปลายทาง field.
export interface HkTramStop { name: string; num: string }
export interface HkTramLine { name: string; color: string; mode: 'tram'; stations: HkTramStop[] }

const GREEN = '#00843D' // the trams' own green livery

export const HK_TRAM: HkTramLine[] = [
  {
    name: 'Tram · Westbound (→ Kennedy Town)',
    color: GREEN,
    mode: 'tram',
    stations: [
      { name: "Shau Kei Wan Terminus", num: "T" }, { name: "Chai Wan Road", num: "02W" },
      { name: "Sun Sing Street", num: "04W" }, { name: "Hoi Foo Street", num: "06W" },
      { name: "Holy Cross Path", num: "08W" }, { name: "Tai Hong Street", num: "10W" },
      { name: "Tai Koo Shing Road", num: "12W" }, { name: "Kornhill", num: "14W" },
      { name: "Shipyard Lane", num: "16W" }, { name: "Mount Parker Road", num: "18W" },
      { name: "Finnie Street", num: "20W" }, { name: "Java Road", num: "22W" },
      { name: "Healthy Street East", num: "24W" }, { name: "Healthy Street West", num: "26W" },
      { name: "Tin Chiu Street", num: "28W" }, { name: "Shu Kuk Street", num: "30W" },
      { name: "North Point Terminus", num: "T" }, { name: "North Point Road", num: "32W" },
      { name: "Fortress Hill", num: "34W" }, { name: "Jupiter Street", num: "36W" },
      { name: "Lau Li Street", num: "38W" }, { name: "Lau Sin Street", num: "40W" },
      { name: "Victoria Park", num: "42W" }, { name: "Shelter Street", num: "44W" },
      { name: "Causeway Bay Terminus", num: "T" }, { name: "Pennington Street", num: "46W" },
      { name: "Paterson Street", num: "48W" }, { name: "Canal Road West", num: "50W" },
      { name: "Tonnochy Road", num: "52W" }, { name: "Burrows Street", num: "54W" },
      { name: "O'Brien Road", num: "56W" }, { name: "Swatow Street", num: "58W" },
      { name: "Gresson Street", num: "60W" }, { name: "Arsenal Street", num: "62W" },
      { name: "Admiralty MTR Station", num: "64W" }, { name: "Cotton Tree Drive", num: "66W" },
      { name: "Bank Street", num: "68W" }, { name: "Pedder Street", num: "70W" },
      { name: "Pottinger Street", num: "72W" }, { name: "Gilman Street", num: "74W" },
      { name: "Man Wah Lane", num: "76W" }, { name: "Western Market Terminus", num: "T" },
      { name: "Macau Ferry Terminal", num: "78W" }, { name: "Connaught Road West", num: "80W" },
      { name: "Sutherland Street", num: "82W" }, { name: "Eastern Street", num: "84W" },
      { name: "Western Street", num: "86W" }, { name: "Water Street", num: "88W" },
      { name: "Whitty Street", num: "90W" }, { name: "Hill Road", num: "92W" },
      { name: "Whitty Street Depot (Shing Sai Road)", num: "94W" }, { name: "Whitty Street Depot", num: "D" },
      { name: "Queen's Road West", num: "96W" }, { name: "Kennedy Town Praya", num: "98W" },
      { name: "Sands Street", num: "100W" }, { name: "Smithfield", num: "102W" },
      { name: "Davis Street", num: "104W" },
    ],
  },
  {
    name: 'Tram · Eastbound (→ Shau Kei Wan)',
    color: GREEN,
    mode: 'tram',
    stations: [
      { name: "Chai Wan Road", num: "101E" }, { name: "Nam Hong Street", num: "99E" },
      { name: "Sai Wan Ho Depot", num: "97E" }, { name: "Hoi Foo Street", num: "95E" },
      { name: "Tai On Street", num: "93E" }, { name: "Tai Hong Street", num: "91E" },
      { name: "Tai Koo Shing Road", num: "89E" }, { name: "Kornhill", num: "87E" },
      { name: "Shipyard Lane", num: "85E" }, { name: "Mount Parker Road", num: "83E" },
      { name: "Finnie Street", num: "81E" }, { name: "Java Road", num: "79E" },
      { name: "Healthy Street East", num: "77E" }, { name: "Healthy Street West", num: "75E" },
      { name: "Tin Chiu Street", num: "73E" }, { name: "Shu Kuk Street", num: "71E" },
      { name: "North Point Road", num: "69E" }, { name: "Chun Yeung Street", num: "67E" },
      { name: "Fortress Hill", num: "65E" }, { name: "Jupiter Street", num: "63E" },
      { name: "Wing Hing Street", num: "61E" }, { name: "Hing Fat Street", num: "59E" },
      { name: "Victoria Park", num: "57E" }, { name: "Shelter Street", num: "55E" },
      { name: "Paterson Street", num: "53E" }, { name: "Percival Street", num: "51E" },
      { name: "Canal Road West", num: "49E" }, { name: "Tonnochy Road", num: "47E" },
      { name: "Fleming Road", num: "45E" }, { name: "O'Brien Road", num: "43E" },
      { name: "Luard Road", num: "41E" }, { name: "Fenwick Street", num: "39E" },
      { name: "Arsenal Street", num: "37E" }, { name: "Admiralty MTR Station", num: "35E" },
      { name: "Murray Road", num: "33E" }, { name: "Bank Street", num: "31E" },
      { name: "Ice House Street", num: "29E" }, { name: "Pedder Street", num: "27E" },
      { name: "Jubilee Street", num: "25E" }, { name: "Gilman Street", num: "23E" },
      { name: "Hillier Street", num: "21E" }, { name: "Western Market Terminus", num: "T" },
      { name: "Macau Ferry Terminal", num: "19E" }, { name: "Queen Street", num: "17E" },
      { name: "Eastern Street", num: "15E" }, { name: "Western Street", num: "13E" },
      { name: "Water Street", num: "11E" }, { name: "Whitty Street", num: "09E" },
      { name: "Shek Tong Tsui Terminus", num: "T" }, { name: "Hill Road", num: "07E" },
      { name: "Queen's Road West", num: "05E" }, { name: "Holland Street", num: "03E" },
      { name: "North Street", num: "01E" }, { name: "Kennedy Town Terminus", num: "T" },
    ],
  },
]

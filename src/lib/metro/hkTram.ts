// Hong Kong Tramways (電車 / "ding ding") — the double-deckers along the north
// shore of Hong Kong Island, a separate railway from the MTR and ridden as a
// tram, so it is offered under รถราง rather than รถไฟฟ้า.
//
// Trams are signed by DESTINATION, not by a line name, and the Transport
// Department publishes the service as six routes along the one corridor — that
// is what a traveller reads on the front of the tram, so that is what we offer.
//
// No stop list: the ~120 stops (eastbound coded 01E… and westbound 02W…) only
// exist in Hong Kong Tramways' own open-data file, which we can't verify from
// here. Leaving the list empty keeps the stop fields free-text rather than
// shipping a half-remembered order that would make the app count stops wrongly.
export interface HkTramLine { name: string; color: string; mode: 'tram'; stations: { name: string }[] }

const GREEN = '#00843D' // the trams' own green livery

const route = (name: string): HkTramLine => ({ name, color: GREEN, mode: 'tram', stations: [] })

export const HK_TRAM: HkTramLine[] = [
  route('Tram · Shau Kei Wan ↔ Kennedy Town'),
  route('Tram · Shau Kei Wan ↔ Western Market'),
  route('Tram · Shau Kei Wan ↔ Happy Valley'),
  route('Tram · Happy Valley ↔ Kennedy Town'),
  route('Tram · North Point ↔ Whitty Street'),
  route('Tram · Causeway Bay ↔ Whitty Street'),
]

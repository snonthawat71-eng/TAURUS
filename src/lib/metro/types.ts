// Metro network model used to auto-compute routes (and draw a tappable map).
// A station that appears on multiple lines (same id) is an interchange.

export interface LineStation {
  id: string // global station id (shared across lines for interchanges)
  name: string
  num: string // per-line station number, e.g. "M16"
}

export interface MetroLine {
  id: string
  name: string
  color: string
  stations: LineStation[] // in order along the line
}

export interface MetroNetwork {
  id: string
  name: string
  /** match a trip to this network by city/country keywords (lowercase) */
  match: string[]
  lines: MetroLine[]
  /** explicit coordinates for hub/interchange stations; others are interpolated */
  hubs: Record<string, [number, number]>
}

// ---- derived, ready-to-render network ----

export interface StationNode {
  id: string
  name: string
  x: number
  y: number
  lineIds: string[]
  /** per-line number keyed by lineId */
  numbers: Record<string, string>
}

export interface BuiltNetwork {
  id: string
  name: string
  lines: MetroLine[]
  lineById: Record<string, MetroLine>
  stations: StationNode[]
  stationById: Record<string, StationNode>
  width: number
  height: number
}

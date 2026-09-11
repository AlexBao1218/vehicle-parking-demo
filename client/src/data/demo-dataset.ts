/**
 * Synthetic fleet for the public demo.
 *
 * Nothing here comes from the employer's data. Plates, sites, departments and
 * people are generic placeholders ("DEMO 101", "Parking Site 03", "Department B",
 * "Coordinator 4"); makes and models are common fleet vehicles chosen at random.
 * Values that would be identifying or financial in the real system (chassis and
 * engine numbers, registration dates, prices, cost centres, vendors, addresses,
 * site photos) are stored as the REDACTED sentinel and rendered as a grey bar.
 */
import { REDACTED } from '@/lib/brand'

// EXPORTS: DemoVehicle, DemoParkingLocation, DEMO_VEHICLES, DEMO_PARKING_LOCATIONS,
//          DEMO_USERS, DEMO_USER_ID, VEHICLE_FIELD_KEYS, streetViewImage, parkingMapImage, hasParkingMap

export interface DemoVehicle {
  id: string
  vicLicense: string
  status: string
  make: string
  model: string
  colour: string
  vehClass: string
  fuelType: string
  company: string
  department: string
  section: string
  transportCoordinator: string
  parkingLocationName: string
  /** Admin-only "Full Details" groups; identifying values are REDACTED */
  extraFields: Record<string, string>
}

export interface DemoParkingLocation {
  id: string
  name: string
  address: string | null
  heightLimitStatus: string | null
  heightLimitMeters: number | null
  streetViewUrls: string[]
  carLift: string | null
  parkingRack: string | null
  allowedVehicleTypes: string[]
  chargingEquipment: string | null
  chargingEquipmentType: string | null
  diagramUrls: string[]
}

/** Maps a change-type `vehicleField` (Base column name) to the DemoVehicle key it edits */
export const VEHICLE_FIELD_KEYS: Record<string, keyof DemoVehicle> = {
  'Transport Coordinator': 'transportCoordinator',
  Department: 'department',
  Section: 'section',
  Company: 'company',
  'Parking Location': 'parkingLocationName',
  Status: 'status',
  Colour: 'colour',
  'Fuel type': 'fuelType',
  'Veh. Class': 'vehClass',
  Make: 'make',
  Model: 'model',
}

export const DEMO_USER_ID = 'demo-user'
export const DEMO_USERS: Record<string, string> = {
  [DEMO_USER_ID]: 'Demo User',
  'user-2': 'Demo Colleague',
}

// ---------------------------------------------------------------------------
// Placeholder images — the real app showed site photos and floor plans from
// Bitable attachments. Those are withheld; the demo draws a labelled schematic
// so the image grid, hover state and lightbox still behave as in production.
// ---------------------------------------------------------------------------

const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif"

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Deterministic pseudo-random in [0, 1) from a seed and an index */
function noise(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297) * 233280
  return x - Math.floor(x)
}

function carShape(x: number, y: number, up: boolean): string {
  // 36 x 62 top-down car; windscreen towards the aisle, rear plain
  const win = up ? y + 40 : y + 10
  return `<g>
    <rect x="${x}" y="${y}" width="36" height="62" rx="9" fill="#3b6fe0" opacity="0.9"/>
    <rect x="${x + 5}" y="${win}" width="26" height="12" rx="3" fill="#dbe7ff" opacity="0.9"/>
  </g>`
}

function mapSvg(label: string, seed: number, plates: string[]): string {
  const bays = 7 + (seed % 2) // 7 or 8 bays per row
  const bayW = 64
  const gap = 8
  const rowW = bays * (bayW + gap) - gap
  const x0 = 200 + Math.round((560 - rowW) / 2)
  const parts: string[] = []
  const rows: Array<[number, boolean, string]> = [[72, true, 'A'], [368, false, 'B']]
  // spread the parked vehicles over the bays deterministically
  const slots = new Map<number, string>()
  const total = bays * 2
  const sorted = [...plates].sort()
  sorted.forEach((plate, k) => {
    let slot = (k * 5 + seed * 3) % total
    while (slots.has(slot)) slot = (slot + 1) % total
    slots.set(slot, plate)
  })
  rows.forEach(([y, up, letter], rowIdx) => {
    for (let i = 0; i < bays; i += 1) {
      const x = x0 + i * (bayW + gap)
      const plate = slots.get(rowIdx * bays + i)
      const labelY = up ? y + 96 : y + 14
      parts.push(`<rect x="${x}" y="${y}" width="${bayW}" height="100" rx="3" fill="${plate ? '#eef3fd' : '#f6f8fb'}" stroke="${plate ? '#9db5ea' : '#c9d2de'}" stroke-width="1.5"/>`)
      if (plate) {
        parts.push(carShape(x + 14, up ? y + 8 : y + 30, up))
        parts.push(`<text x="${x + bayW / 2}" y="${labelY}" text-anchor="middle" font-family="${FONT}" font-size="9.5" font-weight="700" fill="#2a56b8" letter-spacing="0.3">${plate}</text>`)
      } else {
        parts.push(`<text x="${x + bayW / 2}" y="${labelY}" text-anchor="middle" font-family="${FONT}" font-size="10.5" font-weight="600" fill="#8a96a6" letter-spacing="0.5">${letter}${String(i + 1).padStart(2, '0')}</text>`)
      }
    }
    // pillars between every second bay
    for (let i = 0; i <= bays; i += 2) {
      const x = x0 + i * (bayW + gap) - gap / 2 - 5
      parts.push(`<rect x="${x}" y="${up ? y + 104 : y - 14}" width="10" height="10" fill="#4b5563"/>`)
    }
  })
  const aisleY = 270
  const arrowsLeft = seed % 2 === 0
  const arrow = (x: number) => arrowsLeft
    ? `<path d="M${x + 22} ${aisleY - 6} L${x} ${aisleY} L${x + 22} ${aisleY + 6}" fill="none" stroke="#9aa6b8" stroke-width="2"/>`
    : `<path d="M${x} ${aisleY - 6} L${x + 22} ${aisleY} L${x} ${aisleY + 6}" fill="none" stroke="#9aa6b8" stroke-width="2"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="10" stroke="#b9c3d1" stroke-width="3"/>
    </pattern>
  </defs>
  <rect width="960" height="540" fill="#f3f5f8"/>
  <!-- building shell -->
  <rect x="40" y="52" width="880" height="436" rx="12" fill="#ffffff" stroke="#b9c3d1" stroke-width="3"/>
  <!-- ramp -->
  <rect x="62" y="190" width="110" height="160" rx="6" fill="url(#hatch)" stroke="#b9c3d1" stroke-width="1.5"/>
  <rect x="62" y="190" width="110" height="160" rx="6" fill="#ffffff" opacity="0.55"/>
  <text x="117" y="262" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="600" fill="#5b6675" letter-spacing="1.2">RAMP</text>
  <path d="M104 300 L117 284 L130 300" fill="none" stroke="#5b6675" stroke-width="2"/>
  <path d="M104 226 L117 242 L130 226" fill="none" stroke="#5b6675" stroke-width="2"/>
  <!-- lift / stairs core -->
  <rect x="790" y="196" width="112" height="148" rx="6" fill="#e6ebf2" stroke="#b9c3d1" stroke-width="1.5"/>
  <text x="846" y="262" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="600" fill="#5b6675" letter-spacing="1.2">LIFT</text>
  <text x="846" y="282" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#8a96a6" letter-spacing="1">STAIRS</text>
  <!-- drive aisle -->
  <line x1="180" y1="${aisleY}" x2="780" y2="${aisleY}" stroke="#c9d2de" stroke-width="2" stroke-dasharray="16 12"/>
  ${arrow(300)}${arrow(480)}${arrow(660)}
  ${parts.join('\n  ')}
  <!-- title block -->
  <text x="56" y="34" font-family="${FONT}" font-size="17" font-weight="700" fill="#1f2937">${label}</text>
  <!-- north arrow -->
  <g transform="translate(884 26)">
    <path d="M0 -12 L6 8 L0 4 L-6 8 Z" fill="#1f2937"/>
    <text x="0" y="24" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="#1f2937">N</text>
  </g>
  <!-- legend -->
  <g transform="translate(56 508)" font-family="${FONT}" font-size="11" fill="#6b7686">
    <rect x="0" y="-9" width="14" height="10" rx="2" fill="#f6f8fb" stroke="#c9d2de"/>
    <text x="20" y="0">Vacant bay</text>
    <rect x="88" y="-9" width="14" height="10" rx="3" fill="#3b6fe0" opacity="0.9"/>
    <text x="108" y="0">Fleet vehicle</text>
    <rect x="186" y="-8" width="8" height="8" fill="#4b5563"/>
    <text x="200" y="0">Pillar</text>
  </g>
  <text x="904" y="510" text-anchor="end" font-family="${FONT}" font-size="11" fill="#9aa6b8">Schematic · original site plan withheld in public demo</text>
</svg>`
}

function streetSvg(label: string, seed: number, heightLimit: number | null): string {
  const floors = 2 + (seed % 3) // 2..4 storeys above the car park entrance
  const windows: string[] = []
  const top = 350 - floors * 54
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < 8; c += 1) {
      const lit = noise(seed, f * 10 + c) > 0.6
      windows.push(`<rect x="${214 + c * 66}" y="${top + 14 + f * 54}" width="38" height="30" rx="2" fill="${lit ? '#dfe9fb' : '#e8edf3'}" stroke="#c2ccd8"/>`)
    }
  }
  const treeAt = (x: number, h: number) => `<g>
    <rect x="${x - 4}" y="${400 - h}" width="8" height="${h}" fill="#8b7355"/>
    <circle cx="${x}" cy="${400 - h - 6}" r="30" fill="#a9c4a5"/>
    <circle cx="${x - 18}" cy="${400 - h + 8}" r="22" fill="#98b894"/>
    <circle cx="${x + 18}" cy="${400 - h + 8}" r="22" fill="#98b894"/>
  </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef3fa"/>
      <stop offset="1" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#sky)"/>
  <!-- road and pavement -->
  <rect x="0" y="400" width="960" height="140" fill="#d6dde6"/>
  <rect x="0" y="400" width="960" height="14" fill="#c2ccd8"/>
  <line x1="0" y1="476" x2="960" y2="476" stroke="#f3f5f8" stroke-width="3" stroke-dasharray="40 26"/>
  <!-- building -->
  <rect x="180" y="${top - 16}" width="600" height="${416 - top}" fill="#f1f4f8" stroke="#b9c3d1" stroke-width="2.5"/>
  <rect x="180" y="${top - 16}" width="600" height="10" fill="#c2ccd8"/>
  ${windows.join('\n  ')}
  <!-- car park entrance -->
  <rect x="400" y="290" width="200" height="110" fill="#3a4250"/>
  <rect x="400" y="290" width="200" height="110" fill="none" stroke="#b9c3d1" stroke-width="2.5"/>
  <rect x="404" y="294" width="192" height="10" fill="#52607a"/>
  <rect x="460" y="238" width="80" height="40" rx="6" fill="#2a56b8"/>
  <text x="500" y="268" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="700" fill="#ffffff">P</text>
  <!-- barrier -->
  <rect x="404" y="352" width="10" height="48" fill="#5b6675"/>
  <line x1="410" y1="360" x2="580" y2="348" stroke="#f0b429" stroke-width="7" stroke-linecap="round"/>
  <line x1="410" y1="360" x2="580" y2="348" stroke="#ffffff" stroke-width="7" stroke-linecap="butt" stroke-dasharray="18 18"/>
  ${heightLimit != null ? `<!-- height limit sign -->
  <circle cx="640" cy="330" r="24" fill="#ffffff" stroke="#d64545" stroke-width="5"/>
  <text x="640" y="336" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="700" fill="#1f2937">${heightLimit.toFixed(1)}m</text>
  <rect x="637" y="354" width="6" height="46" fill="#5b6675"/>` : ''}
  <!-- lamp -->
  <rect x="120" y="250" width="6" height="150" fill="#5b6675"/>
  <circle cx="123" cy="246" r="9" fill="#f7e6a6" stroke="#5b6675" stroke-width="2"/>
  ${treeAt(72, 70)}
  ${treeAt(870, 84)}
  <!-- car -->
  <g transform="translate(${150 + (seed % 3) * 40} 424)">
    <rect x="0" y="12" width="150" height="34" rx="10" fill="#6b7686"/>
    <path d="M30 12 L48 -12 L112 -12 L128 12 Z" fill="#7c8797"/>
    <rect x="52" y="-8" width="52" height="18" rx="3" fill="#dbe7ff"/>
    <circle cx="36" cy="48" r="12" fill="#1f2937"/>
    <circle cx="116" cy="48" r="12" fill="#1f2937"/>
  </g>
  <text x="32" y="38" font-family="${FONT}" font-size="17" font-weight="700" fill="#1f2937">${label}</text>
  <text x="928" y="518" text-anchor="end" font-family="${FONT}" font-size="11" fill="#7c8797">Illustration · original street photo withheld in public demo</text>
</svg>`
}

/** Street elevation for a site (static) */
export function streetViewImage(label: string, seed = 0, heightLimit: number | null = null): string {
  return svgDataUri(streetSvg(label, seed, heightLimit))
}

/** Floor plan for a site; `plates` are the fleet vehicles currently parked there */
export function parkingMapImage(label: string, seed: number, plates: string[]): string {
  return svgDataUri(mapSvg(label, seed, plates))
}

/** Sites without a plan on file keep the empty state of the image grid */
const SITES_WITHOUT_MAP = new Set(['loc-08'])

export function hasParkingMap(siteId: string): boolean {
  return !SITES_WITHOUT_MAP.has(siteId)
}

// ---------------------------------------------------------------------------
// Parking sites (10)
// ---------------------------------------------------------------------------

const HEIGHT: Array<[string | null, number | null]> = [
  ['有限高', 2.1], ['無限高', null], ['有限高', 1.9], ['未確認', null], ['無限高', null],
  ['有限高', 2.4], ['無限高', null], ['有限高', 2.0], ['未確認', null], ['無限高', null],
]
const CHARGING: Array<[string | null, string | null]> = [
  ['有', 'AC 7 kW'], ['無', null], ['部分有', 'AC 7 kW'], ['未確認', null], ['有', 'DC 60 kW'],
  ['無', null], ['部分有', 'AC 11 kW'], ['無', null], ['有', 'AC 7 kW'], ['未確認', null],
]
const TYPES: string[][] = [
  ['私家車', '客貨車'], ['私家車', '客貨車', '貨車'], ['私家車'], [], ['私家車', '客貨車', '電單車'],
  ['貨車', '客貨車'], ['私家車', '客貨車'], ['私家車'], ['私家車', '客貨車', '貨車'], ['電單車', '私家車'],
]

export const DEMO_PARKING_LOCATIONS: DemoParkingLocation[] = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0')
  const name = `Parking Site ${n}`
  return {
    id: `loc-${n}`,
    name,
    address: REDACTED,
    heightLimitStatus: HEIGHT[i][0],
    heightLimitMeters: HEIGHT[i][1],
    streetViewUrls: i % 2 === 0 ? [streetViewImage(name, i, HEIGHT[i][1])] : [],
    carLift: i % 5 === 2 ? '是' : i % 5 === 4 ? null : '否',
    parkingRack: i % 7 === 3 ? '是' : '否',
    allowedVehicleTypes: TYPES[i],
    chargingEquipment: CHARGING[i][0],
    chargingEquipmentType: CHARGING[i][1],
    /** Filled at request time from the vehicles parked at the site (see platform/) */
    diagramUrls: [],
  }
})

// ---------------------------------------------------------------------------
// Vehicles (36)
// ---------------------------------------------------------------------------

const MODELS: Array<[string, string, string, string, string]> = [
  // make, model, class, fuel, gov class
  ['Toyota', 'Hiace', 'Van', 'Diesel', 'Light Goods Vehicle'],
  ['Isuzu', 'NPR', 'Medium Goods Vehicle', 'Diesel', 'Medium Goods Vehicle'],
  ['Nissan', 'NV350', 'Van', 'Diesel', 'Light Goods Vehicle'],
  ['Toyota', 'Corolla', 'Private Car', 'Hybrid', 'Private Car'],
  ['BYD', 'e6', 'Private Car', 'Electric', 'Private Car'],
  ['Ford', 'Transit', 'Van', 'Diesel', 'Light Goods Vehicle'],
  ['Mitsubishi', 'Canter', 'Medium Goods Vehicle', 'Diesel', 'Medium Goods Vehicle'],
  ['Honda', 'Jazz', 'Private Car', 'Petrol', 'Private Car'],
  ['Hyundai', 'Staria', 'Van', 'Diesel', 'Light Goods Vehicle'],
  ['Hino', '300', 'Medium Goods Vehicle', 'Diesel', 'Medium Goods Vehicle'],
  ['Honda', 'PCX', 'Motorcycle', 'Petrol', 'Motor Cycle'],
  ['Tesla', 'Model Y', 'Private Car', 'Electric', 'Private Car'],
]
const COLOURS = ['White', 'Silver', 'Grey', 'Blue', 'Black']
const DEPTS = ['A', 'B', 'C', 'D', 'E', 'F']

function statusFor(i: number): string {
  if (i % 9 === 0) return 'Sold'
  if (i % 11 === 0) return 'Reserved'
  if (i % 13 === 0) return 'Active (P)'
  if (i === 35) return 'Wait Delivery'
  return 'Active'
}

function buildVehicle(i: number): DemoVehicle {
  const n = 101 + i
  const [make, model, vehClass, fuelType, govClass] = MODELS[(i * 5) % MODELS.length]
  const dept = DEPTS[i % DEPTS.length]
  const siteIdx = (i * 7) % 12
  const parkingLocationName = siteIdx < 10 ? DEMO_PARKING_LOCATIONS[siteIdx].name : ''
  const coordinator = `Coordinator ${1 + (i % 6)}`
  const status = statusFor(i)
  const isGoods = vehClass !== 'Private Car' && vehClass !== 'Motorcycle'
  return {
    id: `veh-${n}`,
    vicLicense: `DEMO ${n}`,
    status,
    make,
    model,
    colour: COLOURS[(i * 3) % COLOURS.length],
    vehClass,
    fuelType,
    company: i % 4 === 0 ? 'Company B' : 'Company A',
    department: `Department ${dept}`,
    section: `Section ${dept}-${1 + (i % 3)}`,
    transportCoordinator: coordinator,
    parkingLocationName,
    extraFields: {
      'Reg. Date': REDACTED,
      'Licence Expiry Date': REDACTED,
      ...(status === 'Sold' ? { 'Sold Date': REDACTED } : {}),
      'Chassis No.': REDACTED,
      'Engine No.': REDACTED,
      'Gov Type Approval No.': REDACTED,
      'Veh. Class (Gov)': govClass,
      'Fleet Number': REDACTED,
      'HK Boarder Control': i % 8 === 5 ? 'Yes' : 'No',
      'Emission Standard': fuelType === 'Electric' ? 'Zero emission' : 'Euro VI',
      'Trans.Type': i % 5 === 0 ? 'Manual' : 'Automatic',
      'Engine Cap. (CC) | Power Rated (kW)':
        fuelType === 'Electric' ? `${120 + (i % 4) * 30} kW` : `${1500 + (i % 6) * 400} cc`,
      'Gross Veh Wt. (Tons)': isGoods ? String(3.5 + (i % 3) * 2) : '',
      'Unladen Wt. (Tons)': isGoods ? String(1.8 + (i % 3) * 0.9) : '',
      'No. of Passengers': vehClass === 'Motorcycle' ? '1' : isGoods ? '2' : '4',
      'Purchase Price': REDACTED,
      'Licence Fee': REDACTED,
      'Depreciation Cost Center': REDACTED,
      'Operation Cost Centre': REDACTED,
      'Exempt from UI Calulation': i % 10 === 7 ? 'Yes' : 'No',
      Camera: i % 3 === 0 ? 'Installed' : 'Not installed',
      GPS: i % 4 === 3 ? 'No' : 'Yes',
      'GPS Company': REDACTED,
      'ADAS Installed': i % 5 === 1 ? 'Yes' : 'No',
      'Windscreen net': isGoods ? 'Installed' : '',
      'Front Cam Installation Date': REDACTED,
      'Cam model & status': REDACTED,
      'Replacement Plan': REDACTED,
      'Draft - Transport Coordinator': coordinator,
      'Remark on change (with date)': REDACTED,
    },
  }
}

const generated = Array.from({ length: 36 }, (_, i) => buildVehicle(i))

/** Base values the seeded requests rely on (see platform/seed.ts) */
const OVERRIDES: Record<string, Partial<DemoVehicle>> = {
  'veh-101': { department: 'Department A', section: 'Section A-1', status: 'Active' },
  'veh-103': { department: 'Department B', section: 'Section B-1' },
  'veh-104': { section: 'Section A-2', department: 'Department A' },
  'veh-107': { parkingLocationName: 'Parking Site 02' },
  'veh-113': { status: 'Active' },
  'veh-115': { transportCoordinator: 'Coordinator 2' },
  'veh-118': { company: 'Company B' },
  'veh-119': { colour: 'Silver' },
  'veh-120': { department: 'Department C', section: 'Section C-2' },
  'veh-122': { parkingLocationName: 'Parking Site 03' },
  'veh-125': { transportCoordinator: 'Coordinator 1' },
}

export const DEMO_VEHICLES: DemoVehicle[] = generated.map((v) =>
  OVERRIDES[v.id] ? { ...v, ...OVERRIDES[v.id] } : v,
)

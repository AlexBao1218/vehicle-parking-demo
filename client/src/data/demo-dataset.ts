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
//          DEMO_USERS, DEMO_USER_ID, VEHICLE_FIELD_KEYS, placeholderImage

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

export function placeholderImage(kind: 'map' | 'street', label: string): string {
  const title = kind === 'map' ? 'Parking map' : 'Street view'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="#f3f4f6"/>
  <g stroke="#d1d5db" stroke-width="2" fill="none">
    <rect x="80" y="80" width="800" height="380" rx="8"/>
    ${kind === 'map'
      ? '<path d="M80 270 H880 M480 80 V460"/><rect x="120" y="120" width="120" height="60" rx="4"/><rect x="260" y="120" width="120" height="60" rx="4"/><rect x="400" y="120" width="60" height="60" rx="4"/><rect x="520" y="120" width="120" height="60" rx="4"/><rect x="660" y="120" width="120" height="60" rx="4"/><rect x="120" y="360" width="120" height="60" rx="4"/><rect x="260" y="360" width="120" height="60" rx="4"/><rect x="520" y="360" width="120" height="60" rx="4"/><rect x="660" y="360" width="120" height="60" rx="4"/>'
      : '<path d="M80 400 L880 400 M200 400 L200 180 L420 180 L420 400 M520 400 L520 220 L760 220 L760 400"/><circle cx="640" cy="150" r="30"/>'}
  </g>
  <text x="480" y="262" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="26" fill="#6b7280">${title} · ${label}</text>
  <text x="480" y="298" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#9ca3af">Site image withheld in public demo</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
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
  const diagrams = i % 4 === 3 ? 0 : i % 3 === 0 ? 2 : 1
  return {
    id: `loc-${n}`,
    name,
    address: REDACTED,
    heightLimitStatus: HEIGHT[i][0],
    heightLimitMeters: HEIGHT[i][1],
    streetViewUrls: i % 2 === 0 ? [placeholderImage('street', name)] : [],
    carLift: i % 5 === 2 ? '是' : i % 5 === 4 ? null : '否',
    parkingRack: i % 7 === 3 ? '是' : '否',
    allowedVehicleTypes: TYPES[i],
    chargingEquipment: CHARGING[i][0],
    chargingEquipmentType: CHARGING[i][1],
    diagramUrls: Array.from({ length: diagrams }, (_, d) => placeholderImage('map', `${name} · Level ${d + 1}`)),
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

/**
 * Local replacement for `@lark-apaas/client-toolkit`.
 *
 * The original app ran inside Feishu Spark (妙搭), whose runtime injected
 * logging, user identity, scoped storage, file buckets, an authenticated axios
 * instance for the NestJS backend and Bitable "capabilities". This shim keeps
 * the same import surface so page code is untouched, and serves everything
 * from the synthetic dataset and the in-browser backend. Aliased in
 * vite.config.ts and tsconfig.app.json.
 */
import React, { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { ApiResponse } from '@shared/api.interface'
import { DEMO_PARKING_LOCATIONS, DEMO_USER_ID, DEMO_USERS, type DemoVehicle } from '@/data/demo-dataset'
import { getStore, saveStore } from './store'
import { diagramUrlsFor, handleRequest, type HttpMethod } from './backend'

// ---- logger ----
const tag = '[demo]'
export const logger = {
  info: (...a: unknown[]) => console.info(tag, ...a),
  warn: (...a: unknown[]) => console.warn(tag, ...a),
  error: (...a: unknown[]) => console.error(tag, ...a),
  debug: (...a: unknown[]) => console.debug(tag, ...a),
}

// ---- capabilities (Bitable readers / writers) ----
// The pages call two plugin instances directly: the fleet list (search, get,
// batch update) and the parking sites table (search, get). Records are shaped
// like Bitable responses: text fields as `{ text }`, attachments as `{ tmpUrl }`.

const VEHICLE_PLUGIN = 'vehicle_list_draft_readonly_query_3'
const VEHICLE_WRITE_PLUGIN = 'vehicle_list_draft_batch_update_1'
const PARKING_PLUGIN = 'parking_location_map_readonly_query_3'

interface FilterCondition { fieldName: string; operator: string; value: string[] }
interface SearchInput {
  filter?: { conjunction: string; conditions: FilterCondition[] }
  fieldNames?: string[]
  pageSize?: number
}

type PluginRecord = { id: string; record: Record<string, unknown> }

function vehicleRecord(v: DemoVehicle): PluginRecord {
  return {
    id: v.id,
    record: {
      VicLicense: { text: v.vicLicense },
      Status: v.status,
      Make: v.make,
      Model: v.model,
      Colour: v.colour,
      'Veh. Class': v.vehClass,
      'Fuel type': v.fuelType,
      Company: v.company,
      Department: v.department,
      Section: v.section,
      'Transport Coordinator': v.transportCoordinator,
      'Parking Location': v.parkingLocationName,
    },
  }
}

function parkingRecord(p: (typeof DEMO_PARKING_LOCATIONS)[number]): PluginRecord {
  return {
    id: p.id,
    record: {
      Location: { text: p.name },
      Diagram: diagramUrlsFor(p).map((url, i) => ({ name: `diagram-${i + 1}.svg`, size: 0, tmpUrl: url, type: 'image/svg+xml' })),
    },
  }
}

function textOf(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object' && 'text' in val) return String((val as { text: unknown }).text ?? '')
  return String(val)
}

function applyFilter(records: PluginRecord[], input: SearchInput): PluginRecord[] {
  const conditions = input.filter?.conditions ?? []
  const filtered = records.filter((r) =>
    conditions.every((c) => {
      const haystack = textOf(r.record[c.fieldName]).toLowerCase()
      const needles = (c.value ?? []).map((v) => String(v).toLowerCase())
      switch (c.operator) {
        case 'contains':
          return needles.some((n) => haystack.includes(n))
        case 'is':
          return needles.some((n) => haystack === n)
        case 'isNotEmpty':
          return haystack.length > 0
        default:
          return true
      }
    }),
  )
  return typeof input.pageSize === 'number' ? filtered.slice(0, input.pageSize) : filtered
}

const VEHICLE_KEYS: Record<string, keyof DemoVehicle> = {
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

async function callCapability(pluginId: string, method: string, input: unknown): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 120))
  const store = getStore()

  if (pluginId === VEHICLE_PLUGIN || pluginId === VEHICLE_WRITE_PLUGIN) {
    if (method === 'searchRecords') {
      const records = applyFilter(store.vehicles.map(vehicleRecord), (input ?? {}) as SearchInput)
      return { records, hasMore: false, total: records.length }
    }
    if (method === 'getRecord') {
      const { recordID } = input as { recordID: string }
      const v = store.vehicles.find((x) => x.id === recordID)
      if (!v) throw new Error(`Vehicle record ${recordID} not found`)
      return vehicleRecord(v)
    }
    if (method === 'batchUpdateRecords') {
      const { records } = input as { records: Array<{ id: string; record: Record<string, unknown> }> }
      const ids: string[] = []
      for (const upd of records) {
        const v = store.vehicles.find((x) => x.id === upd.id)
        if (!v) continue
        for (const [field, value] of Object.entries(upd.record)) {
          const key = VEHICLE_KEYS[field]
          if (key) (v as unknown as Record<string, unknown>)[key] = textOf(value)
        }
        ids.push(v.id)
      }
      saveStore()
      return { records: ids.map((id) => ({ id })) }
    }
  }

  if (pluginId === PARKING_PLUGIN) {
    if (method === 'searchRecords') {
      const records = applyFilter(DEMO_PARKING_LOCATIONS.map(parkingRecord), (input ?? {}) as SearchInput)
      return { records, hasMore: false, total: records.length }
    }
    if (method === 'getRecord') {
      const { recordID } = input as { recordID: string }
      const p = DEMO_PARKING_LOCATIONS.find((x) => x.id === recordID)
      if (!p) throw new Error(`Parking record ${recordID} not found`)
      return parkingRecord(p)
    }
  }

  throw new Error(`Capability "${pluginId}.${method}" is not available in the public demo`)
}

export const capabilityClient = {
  load(id: string) {
    return {
      call<T>(method: string, input?: unknown): Promise<T> {
        return callCapability(id, method, input) as Promise<T>
      },
    }
  },
}

// ---- current user ----
export interface IUserProfile {
  user_id?: string
  name?: string
  email?: string
  avatar?: string
}
export const DEMO_USER: IUserProfile = {
  user_id: DEMO_USER_ID,
  name: DEMO_USERS[DEMO_USER_ID],
}
export const useCurrentUserProfile = (): Partial<IUserProfile> => DEMO_USER
export const getCurrentUserProfile = async () => DEMO_USER

// ---- scoped storage ----
const PREFIX = 'demo:'
/** First visit: the search page opens with this vehicle already looked up */
const STORAGE_DEFAULTS: Record<string, string> = {
  __global_vpi_selectedVehicleId: 'veh-101',
}
export const scopedStorage = {
  getItem: (k: string) => {
    try { return localStorage.getItem(PREFIX + k) ?? STORAGE_DEFAULTS[k] ?? null } catch { return STORAGE_DEFAULTS[k] ?? null }
  },
  setItem: (k: string, v: string) => {
    try { localStorage.setItem(PREFIX + k, v) } catch { /* ignore */ }
  },
  removeItem: (k: string) => {
    try { localStorage.removeItem(PREFIX + k) } catch { /* ignore */ }
  },
}

// ---- links ----
export interface UniversalLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
}
export const UniversalLink = forwardRef<HTMLAnchorElement, UniversalLinkProps>(
  function UniversalLink({ to, children, ...rest }, ref) {
    if (/^(https?:|data:|blob:)/.test(to)) {
      return (
        <a ref={ref} href={to} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
        </a>
      )
    }
    return (
      <Link ref={ref} to={to} {...rest}>
        {children}
      </Link>
    )
  },
)

// ---- app shell ----
export const AppContainer: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <TooltipProvider delayDuration={200}>
    {children}
    <Toaster />
  </TooltipProvider>
)

export const ErrorRender: React.FC<{
  error: unknown
  resetErrorBoundary?: (...args: unknown[]) => void
}> = ({ error, resetErrorBoundary }) => (
  <div style={{ padding: 32, fontFamily: 'system-ui' }}>
    <h2>Something went wrong</h2>
    <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.7 }}>
      {error instanceof Error ? error.message : String(error)}
    </pre>
    {resetErrorBoundary && <button onClick={() => resetErrorBoundary()}>Retry</button>}
  </div>
)

// ---- backend axios ----
// Same call shape as the platform's authenticated axios instance; requests are
// answered by the in-browser backend instead of the NestJS server.
interface AxiosLikeResponse<T> { data: T }
interface AxiosLikeConfig { params?: Record<string, unknown> }

async function request<T>(method: HttpMethod, url: string, body?: unknown, config?: AxiosLikeConfig): Promise<AxiosLikeResponse<T>> {
  const params = Object.fromEntries(
    Object.entries(config?.params ?? {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)]),
  )
  const data = await handleRequest(method, url, body, { params })
  return { data: data as T }
}

export const axiosForBackend = {
  get: <T = ApiResponse,>(url: string, config?: AxiosLikeConfig) => request<T>('get', url, undefined, config),
  post: <T = ApiResponse,>(url: string, body?: unknown, config?: AxiosLikeConfig) => request<T>('post', url, body, config),
  patch: <T = ApiResponse,>(url: string, body?: unknown, config?: AxiosLikeConfig) => request<T>('patch', url, body, config),
  delete: <T = ApiResponse,>(url: string, config?: AxiosLikeConfig) => request<T>('delete', url, undefined, config),
}

export const isMobile = () => /Mobi|Android/i.test(navigator.userAgent)

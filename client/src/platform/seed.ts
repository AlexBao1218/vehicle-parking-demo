/**
 * Seeded workflow state for the demo: a handful of requests in every status,
 * so the admin console, after-approval tab, sync drawer, archive and
 * "My Requests" page all have something to show on first load.
 *
 * Dates are relative to the moment the store is seeded, so "effective today"
 * and "not yet synced" states stay meaningful whenever the demo is opened.
 */
import type { AttachmentInfo, EditHistoryEntry } from '@shared/api.interface'
import { DEMO_USER_ID, DEMO_VEHICLES } from '@/data/demo-dataset'

// EXPORTS: StoredRequest, StoredLogbookRow, DemoStore, buildSeed

export interface StoredRequest {
  id: string
  changeType: string
  vehicleId: string
  vehicleLicense: string
  logFrom: string
  logTo: string
  /** YYYY-MM-DD or null */
  effectiveDate: string | null
  remark: string
  status: string
  attachments: AttachmentInfo[]
  approver: string | null
  approvalTime: string | null
  approvalComment: string | null
  vehicleSyncedAt: string | null
  editHistory: EditHistoryEntry[]
  followUpCompletedAt: string | null
  createdAt: string
  createdBy: string
  updatedAt: string
}

export interface StoredLogbookRow {
  id: string
  logDate: string
  vicLicense: string
  changeType: string
  logFrom: string
  logTo: string
  remark: string
  syncStatus: '未同步' | '已同步'
  sourceRequestId: string
  createdAt: string
}

export interface DemoStore {
  version: number
  seededAt: string
  vehicles: typeof DEMO_VEHICLES
  changeRequests: StoredRequest[]
  logbook: StoredLogbookRow[]
}

export const STORE_VERSION = 1

function iso(daysFromNow: number, hour = 10): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 15, 0, 0)
  return d.toISOString()
}

function dateOnly(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface SeedInput {
  id: string
  changeType: string
  vehicleId: string
  logFrom?: string
  logTo?: string
  effectiveDays?: number | null
  remark?: string
  status: '草稿' | '待审批' | '已批准' | '已拒絕'
  createdBy?: string
  createdDays: number
  approvedDays?: number
  approvalComment?: string
  syncedDays?: number | null
  followUpDoneDays?: number | null
  editHistory?: EditHistoryEntry[]
}

function plate(vehicleId: string): string {
  return DEMO_VEHICLES.find((v) => v.id === vehicleId)?.vicLicense ?? vehicleId
}

function request(s: SeedInput): StoredRequest {
  const approved = s.approvedDays !== undefined
  return {
    id: s.id,
    changeType: s.changeType,
    vehicleId: s.vehicleId,
    vehicleLicense: plate(s.vehicleId),
    logFrom: s.logFrom ?? '',
    logTo: s.logTo ?? '',
    effectiveDate: s.effectiveDays == null ? null : dateOnly(s.effectiveDays),
    remark: s.remark ?? '',
    status: s.status,
    attachments: [],
    approver: approved ? DEMO_USER_ID : null,
    approvalTime: approved ? iso(s.approvedDays as number, 15) : null,
    approvalComment: s.approvalComment ?? null,
    vehicleSyncedAt: s.syncedDays == null ? null : iso(s.syncedDays, 15),
    editHistory: s.editHistory ?? [],
    followUpCompletedAt: s.followUpDoneDays == null ? null : iso(s.followUpDoneDays, 16),
    createdAt: iso(-s.createdDays, 9),
    createdBy: s.createdBy ?? DEMO_USER_ID,
    updatedAt: iso(approved ? (s.approvedDays as number) : -s.createdDays, 15),
  }
}

export function buildSeed(): DemoStore {
  const requests: StoredRequest[] = [
    // ── Pending ────────────────────────────────────────────────────────
    request({
      id: 'req-01', changeType: 'Department', vehicleId: 'veh-103',
      logFrom: 'Department B', logTo: 'Department D', effectiveDays: 3,
      remark: 'Team transfer agreed with both department heads.',
      status: '待审批', createdBy: 'user-2', createdDays: 2,
    }),
    request({
      id: 'req-02', changeType: 'Parking Location', vehicleId: 'veh-107',
      logFrom: 'Parking Site 02', logTo: 'Parking Site 05', effectiveDays: 0,
      remark: 'Closer to the new work base.',
      status: '待审批', createdDays: 1,
    }),
    request({
      id: 'req-03', changeType: 'Fuel Card Reissue', vehicleId: 'veh-110',
      remark: 'Card lost during a site visit; replacement needed before the next fuel run.',
      status: '待审批', createdBy: 'user-2', createdDays: 1,
    }),
    request({
      id: 'req-04', changeType: '其他', vehicleId: 'veh-112',
      remark: 'Please set up an annual inspection reminder for this vehicle.',
      status: '待审批', createdDays: 0,
    }),
    request({
      id: 'req-05', changeType: 'Transport Coordinator', vehicleId: 'veh-115',
      logFrom: 'Coordinator 2', logTo: 'Coordinator 4', effectiveDays: -1,
      remark: '',
      status: '待审批', createdBy: 'user-2', createdDays: 3,
      editHistory: [{
        editedAt: iso(-1, 11),
        editedBy: DEMO_USER_ID,
        changes: [{ field: 'logTo', from: 'Coordinator 3', to: 'Coordinator 4' }],
      }],
    }),
    // ── Approved and already written back ──────────────────────────────
    request({
      id: 'req-06', changeType: 'Section', vehicleId: 'veh-104',
      logFrom: 'Section A-1', logTo: 'Section A-2', effectiveDays: -10,
      status: '已批准', createdDays: 12, approvedDays: -9, syncedDays: -9,
      approvalComment: 'OK.',
    }),
    request({
      id: 'req-07', changeType: 'Company', vehicleId: 'veh-118',
      logFrom: 'Company A', logTo: 'Company B', effectiveDays: -20,
      status: '已批准', createdBy: 'user-2', createdDays: 22, approvedDays: -19, syncedDays: -19,
    }),
    request({
      id: 'req-15', changeType: 'Colour', vehicleId: 'veh-119',
      logFrom: 'White', logTo: 'Silver', effectiveDays: -40,
      remark: 'Repainted after body repair.',
      status: '已批准', createdBy: 'user-2', createdDays: 42, approvedDays: -39, syncedDays: -39,
    }),
    // ── Approved, effective date reached, not yet written back ─────────
    request({
      id: 'req-08', changeType: 'Department', vehicleId: 'veh-120',
      logFrom: 'Department C', logTo: 'Department E', effectiveDays: -2,
      remark: 'Effective from the start of the month.',
      status: '已批准', createdBy: 'user-2', createdDays: 8, approvedDays: -6,
    }),
    request({
      id: 'req-09', changeType: 'Parking Location', vehicleId: 'veh-122',
      logFrom: 'Parking Site 03', logTo: 'Parking Site 06', effectiveDays: -1,
      status: '已批准', createdDays: 6, approvedDays: -4,
    }),
    // ── Approved, future effective date ────────────────────────────────
    request({
      id: 'req-10', changeType: 'Transport Coordinator', vehicleId: 'veh-125',
      logFrom: 'Coordinator 1', logTo: 'Coordinator 5', effectiveDays: 14,
      status: '已批准', createdBy: 'user-2', createdDays: 2, approvedDays: -1,
    }),
    // ── Approved offline requests (follow-up list) ─────────────────────
    request({
      id: 'req-11', changeType: 'Ignition Card Reissue', vehicleId: 'veh-108',
      remark: 'Ignition card stopped working after water damage.',
      status: '已批准', createdBy: 'user-2', createdDays: 3, approvedDays: -2,
    }),
    request({
      id: 'req-12', changeType: 'Vehicle Key Reissue', vehicleId: 'veh-111',
      remark: 'Spare key requested for the night shift.',
      status: '已批准', createdDays: 16, approvedDays: -15, followUpDoneDays: -14,
    }),
    // ── Rejected ───────────────────────────────────────────────────────
    request({
      id: 'req-13', changeType: 'Status', vehicleId: 'veh-113',
      logFrom: 'Active', logTo: 'Sold', effectiveDays: -8,
      status: '已拒絕', createdDays: 9, approvedDays: -8,
      approvalComment: 'Disposal must go through the asset team first.',
    }),
    request({
      id: 'req-14', changeType: 'Department', vehicleId: 'veh-116',
      logFrom: 'Department E', logTo: 'Department F', effectiveDays: -12,
      status: '已拒絕', createdBy: 'user-2', createdDays: 13, approvedDays: -12,
      approvalComment: 'Duplicate of an earlier request.',
    }),
    // ── Drafts of the demo user ────────────────────────────────────────
    request({
      id: 'req-16', changeType: 'Department', vehicleId: 'veh-101',
      logFrom: 'Department A', logTo: 'Department B', effectiveDays: 7,
      status: '草稿', createdDays: 0,
    }),
    request({
      id: 'req-17', changeType: 'Fuel Card Reissue', vehicleId: 'veh-102',
      remark: 'Card damaged.',
      status: '草稿', createdDays: 0,
    }),
  ]

  const logbook: StoredLogbookRow[] = []
  const log = (
    r: StoredRequest,
    syncStatus: StoredLogbookRow['syncStatus'],
  ) => {
    logbook.push({
      id: `log-${r.id}`,
      logDate: r.effectiveDate ? new Date(r.effectiveDate + 'T00:00:00').toISOString() : r.approvalTime ?? r.createdAt,
      vicLicense: r.vehicleLicense,
      changeType: r.changeType,
      logFrom: r.logFrom,
      logTo: r.logTo,
      remark: r.remark,
      syncStatus,
      sourceRequestId: r.id,
      createdAt: r.approvalTime ?? r.createdAt,
    })
  }
  const byId = new Map(requests.map((r) => [r.id, r]))
  log(byId.get('req-06')!, '已同步')
  log(byId.get('req-07')!, '已同步')
  log(byId.get('req-15')!, '已同步')
  log(byId.get('req-08')!, '未同步')
  log(byId.get('req-09')!, '未同步')
  log(byId.get('req-10')!, '未同步')

  return {
    version: STORE_VERSION,
    seededAt: new Date().toISOString(),
    vehicles: DEMO_VEHICLES.map((v) => ({ ...v, extraFields: { ...v.extraFields } })),
    changeRequests: requests,
    logbook,
  }
}

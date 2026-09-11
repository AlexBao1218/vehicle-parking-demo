/**
 * In-browser replacement for the NestJS backend.
 *
 * Every REST endpoint the pages call (`/api/...`) is routed here and served from
 * the localStorage store. The business rules mirror the original services
 * (reference/server/modules/**): draft lifecycle, the change-type registry
 * split (logbook vs. write-back vs. follow-up), effective-date gating of the
 * write-back, admin edit history, archive filtering and pagination.
 */
import type {
  ApiResponse, DraftRecord, CreateDraftRequest, UpdateDraftRequest,
  ApprovalRecord, AdminCheckResponse, VehicleDetailResponse,
  ApprovalRequestListResponse, PendingLogbookRow, MarkSyncedResult,
  FollowUpItem, PendingVehicleSyncRow, ExecuteVehicleSyncResult,
  EditRequest, EditHistoryEntry, ArchiveQuery, ArchiveListResponse,
  SyncStatusResponse, BatchApproveResult, ParkingLocationSummary,
  ParkingLocationDetail, ParkedVehicleSummary, AttachmentInfo,
} from '@shared/api.interface'
import { CHANGE_TYPES, getChangeType, isSubmittableChangeType } from '@shared/change-types'
import { formatLogbookDate } from '@shared/format-logbook-date'
import { DEMO_PARKING_LOCATIONS, DEMO_USER_ID, DEMO_USERS, VEHICLE_FIELD_KEYS, type DemoVehicle } from '@/data/demo-dataset'
import { getStore, saveStore } from './store'
import type { StoredRequest } from './seed'

// EXPORTS: handleRequest, HttpMethod

export type HttpMethod = 'get' | 'post' | 'patch' | 'delete'

const STATUS_DRAFT = '草稿'
const STATUS_PENDING = '待审批'
const STATUS_APPROVED = '已批准'
const STATUS_REJECTED = '已拒絕'

const LATENCY_MS = 160

function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { success: true, data, message }
}

function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}

function todayEnd(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function effectiveTs(date: string | null): number | null {
  if (!date) return null
  const t = new Date(date + 'T00:00:00').getTime()
  return Number.isFinite(t) ? t : null
}

function isEffectiveNow(date: string | null): boolean {
  const ts = effectiveTs(date)
  return ts === null || ts <= todayEnd().getTime()
}

function userName(id: string | null | undefined): string | undefined {
  return id ? DEMO_USERS[id] : undefined
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function toDraft(r: StoredRequest): DraftRecord {
  return {
    id: r.id,
    changeType: r.changeType,
    vehicleId: r.vehicleId,
    vehicleLicense: r.vehicleLicense,
    logFrom: r.logFrom,
    logTo: r.logTo,
    effectiveDate: r.effectiveDate,
    effectiveDateTs: effectiveTs(r.effectiveDate),
    remark: r.remark,
    attachments: r.attachments,
    status: r.status,
    applyTime: r.createdAt,
  }
}

function toApproval(r: StoredRequest): ApprovalRecord {
  return {
    id: r.id,
    changeType: r.changeType,
    vehicleId: r.vehicleId,
    vehicleLicense: r.vehicleLicense,
    logFrom: r.logFrom,
    logTo: r.logTo,
    effectiveDate: r.effectiveDate,
    effectiveDateTs: effectiveTs(r.effectiveDate),
    remark: r.remark,
    status: r.status,
    applyTime: r.createdAt,
    attachments: r.attachments,
    applicantName: userName(r.createdBy),
    approverName: userName(r.approver),
    approvalTime: r.approvalTime ?? undefined,
    approvalComment: r.approvalComment ?? undefined,
    editHistory: r.editHistory,
  }
}

function findVehicle(id: string): DemoVehicle | undefined {
  return getStore().vehicles.find((v) => v.id === id)
}

function vehicleFieldValue(v: DemoVehicle, fieldName: string): string {
  const key = VEHICLE_FIELD_KEYS[fieldName]
  return key ? String(v[key] ?? '') : ''
}

function toVehicleDetail(v: DemoVehicle, isAdmin: boolean): VehicleDetailResponse {
  const base: VehicleDetailResponse = {
    id: v.id,
    vicLicense: v.vicLicense,
    status: v.status,
    make: v.make,
    model: v.model,
    colour: v.colour,
    vehClass: v.vehClass,
    fuelType: v.fuelType,
    company: v.company,
    department: v.department,
    section: v.section,
    transportCoordinator: v.transportCoordinator,
    parkingLocationName: v.parkingLocationName,
  }
  if (isAdmin) base.extraFields = { ...v.extraFields }
  return base
}

function assertSubmittable(changeType: string): void {
  const def = getChangeType(changeType)
  if (!def) throw new Error(`Unknown change type "${changeType}"`)
  if (!def.enabled) throw new Error(`Change type "${def.label}" is not open for new requests`)
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

function listDrafts(userId: string): DraftRecord[] {
  return getStore().changeRequests
    .filter((r) => r.status === STATUS_DRAFT && r.createdBy === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toDraft)
}

function createDraft(dto: CreateDraftRequest, userId: string): DraftRecord {
  assertSubmittable(dto.changeType)
  const now = new Date().toISOString()
  const row: StoredRequest = {
    id: newId('req'),
    changeType: dto.changeType,
    vehicleId: dto.vehicleId,
    vehicleLicense: dto.vehicleLicense,
    logFrom: dto.logFrom,
    logTo: dto.logTo,
    effectiveDate: dto.effectiveDate || null,
    remark: dto.remark,
    status: STATUS_DRAFT,
    attachments: (dto.attachments ?? []) as AttachmentInfo[],
    approver: null,
    approvalTime: null,
    approvalComment: null,
    vehicleSyncedAt: null,
    editHistory: [],
    followUpCompletedAt: null,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
  }
  getStore().changeRequests.push(row)
  saveStore()
  return toDraft(row)
}

function updateDraft(id: string, dto: UpdateDraftRequest, userId: string): DraftRecord {
  if (dto.changeType !== undefined) assertSubmittable(dto.changeType)
  const row = getStore().changeRequests.find((r) => r.id === id && r.createdBy === userId)
  if (!row) throw new Error('Draft not found')
  if (dto.changeType !== undefined) row.changeType = dto.changeType
  if (dto.vehicleId !== undefined) row.vehicleId = dto.vehicleId
  if (dto.vehicleLicense !== undefined) row.vehicleLicense = dto.vehicleLicense
  if (dto.logFrom !== undefined) row.logFrom = dto.logFrom
  if (dto.logTo !== undefined) row.logTo = dto.logTo
  if (dto.effectiveDate !== undefined) row.effectiveDate = dto.effectiveDate || null
  if (dto.remark !== undefined) row.remark = dto.remark
  if (dto.attachments !== undefined) row.attachments = dto.attachments
  row.updatedAt = new Date().toISOString()
  saveStore()
  return toDraft(row)
}

function deleteDraft(id: string, userId: string): void {
  const store = getStore()
  const idx = store.changeRequests.findIndex((r) => r.id === id && r.createdBy === userId)
  if (idx < 0) throw new Error('Draft not found')
  store.changeRequests.splice(idx, 1)
  saveStore()
}

function submitDrafts(ids: string[], userId: string): number {
  const targets = getStore().changeRequests.filter(
    (r) => ids.includes(r.id) && r.createdBy === userId && r.status === STATUS_DRAFT,
  )
  const blocked = targets.filter((t) => !isSubmittableChangeType(t.changeType))
  if (blocked.length > 0) {
    const names = [...new Set(blocked.map((t) => t.changeType))].join(', ')
    throw new Error(`These change types are not open for submission: ${names}`)
  }
  const now = new Date().toISOString()
  targets.forEach((t) => {
    t.status = STATUS_PENDING
    t.createdAt = now
    t.updatedAt = now
  })
  saveStore()
  return targets.length
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

function checkAdmin(): AdminCheckResponse {
  return { isAdmin: true, syncMode: 'production', testVehicleLicenses: [] }
}

function listRequests(status: string | undefined): ApprovalRequestListResponse {
  const items = getStore().changeRequests
    .filter((r) => r.status !== STATUS_DRAFT && (!status || status === '全部' || r.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toApproval)
  return { items, total: items.length }
}

function listMyRequests(userId: string): ApprovalRecord[] {
  return getStore().changeRequests
    .filter((r) => r.createdBy === userId && r.status !== STATUS_DRAFT)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toApproval)
}

function listArchive(query: ArchiveQuery): ArchiveListResponse {
  let rows = getStore().changeRequests.filter((r) => r.status !== STATUS_DRAFT)

  const license = (query.vehicleLicense ?? '').trim().toLowerCase()
  if (license) rows = rows.filter((r) => r.vehicleLicense.toLowerCase().includes(license))

  const applicant = (query.applicant ?? '').trim()
  if (applicant) rows = rows.filter((r) => r.createdBy === applicant)

  const changeType = (query.changeType ?? '').trim()
  const category = (query.category ?? '').trim()
  if (changeType) {
    rows = rows.filter((r) => r.changeType === changeType)
  } else if (category) {
    const ids = CHANGE_TYPES.filter((d) => d.category === category).map((d) => d.id)
    rows = rows.filter((r) => ids.includes(r.changeType))
  }

  if (query.status && query.status !== '全部') rows = rows.filter((r) => r.status === query.status)

  const dateFrom = (query.dateFrom ?? '').trim()
  if (dateFrom) {
    const from = new Date(dateFrom + 'T00:00:00').getTime()
    rows = rows.filter((r) => new Date(r.createdAt).getTime() >= from)
  }
  const dateTo = (query.dateTo ?? '').trim()
  if (dateTo) {
    const to = new Date(dateTo + 'T23:59:59.999').getTime()
    rows = rows.filter((r) => new Date(r.createdAt).getTime() <= to)
  }

  const page = Math.max(1, parseInt(query.page ?? '', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '', 10) || 20))
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize).map(toApproval),
    total: rows.length,
    page,
    pageSize,
  }
}

function editRequest(id: string, dto: EditRequest, userId: string): ApprovalRecord {
  const req = getStore().changeRequests.find((r) => r.id === id)
  if (!req) throw new Error('Request not found')
  if (req.status !== STATUS_PENDING) {
    throw new Error('Only pending requests can be edited')
  }

  const changes: EditHistoryEntry['changes'] = []
  if (dto.changeType !== undefined) {
    if (!isSubmittableChangeType(dto.changeType)) {
      throw new Error(`Change type "${dto.changeType}" is not open for submission`)
    }
    if (dto.logTo === undefined) {
      throw new Error('A new Log-To is required when the change type changes')
    }
    if (dto.changeType !== req.changeType) {
      changes.push({ field: 'changeType', from: req.changeType, to: dto.changeType })
    }
  }
  if (dto.logFrom !== undefined && dto.logFrom !== req.logFrom) {
    changes.push({ field: 'logFrom', from: req.logFrom, to: dto.logFrom })
  }
  if (dto.logTo !== undefined && dto.logTo !== req.logTo) {
    changes.push({ field: 'logTo', from: req.logTo, to: dto.logTo })
  }
  if (dto.effectiveDate !== undefined) {
    const newDate = dto.effectiveDate ? dto.effectiveDate : null
    const oldDate = req.effectiveDate ?? ''
    if (newDate !== oldDate && !(newDate === null && oldDate === '')) {
      changes.push({ field: 'effectiveDate', from: oldDate, to: newDate ?? '' })
    }
  }
  if (dto.remark !== undefined && dto.remark !== req.remark) {
    changes.push({ field: 'remark', from: req.remark, to: dto.remark })
  }
  if (changes.length === 0) throw new Error('No changes were made')

  if (dto.changeType !== undefined) req.changeType = dto.changeType
  if (dto.logFrom !== undefined) req.logFrom = dto.logFrom
  if (dto.logTo !== undefined) req.logTo = dto.logTo
  if (dto.effectiveDate !== undefined) req.effectiveDate = dto.effectiveDate || null
  if (dto.remark !== undefined) req.remark = dto.remark
  req.editHistory = [...req.editHistory, { editedAt: new Date().toISOString(), editedBy: userId, changes }]
  req.updatedAt = new Date().toISOString()
  saveStore()
  return toApproval(req)
}

/** Writes one field of the fleet record; mirrors the Base write-back with read-back check */
function syncVehicleField(vehicleId: string, fieldName: string, expected: string): { ok: true } | { ok: false; error: string } {
  const v = findVehicle(vehicleId)
  if (!v) return { ok: false, error: 'Vehicle record not found in the fleet list' }
  const key = VEHICLE_FIELD_KEYS[fieldName]
  if (!key) return { ok: false, error: `Field "${fieldName}" cannot be written back` }
  ;(v as unknown as Record<string, string>)[key] = expected
  const actual = vehicleFieldValue(v, fieldName).trim()
  if (actual !== expected) {
    return { ok: false, error: `Write-back check failed: expected "${expected}", read back "${actual}"` }
  }
  return { ok: true }
}

function approve(id: string, approvalComment: string | undefined, userId: string): { id: string; status: string } {
  const store = getStore()
  const req = store.changeRequests.find((r) => r.id === id)
  if (!req) throw new Error('Request not found')
  if (req.status !== STATUS_PENDING) throw new Error(`Request cannot be approved in status "${req.status}"`)

  const def = getChangeType(req.changeType)
  if (!def) throw new Error(`Unregistered change type "${req.changeType}"`)
  if (def.handler) throw new Error(`Handler "${def.handler}" for "${def.label}" is not implemented yet`)

  const now = new Date().toISOString()
  const shouldSync = def.syncsVehicleField && isEffectiveNow(req.effectiveDate)

  if (def.writesLogbook) {
    store.logbook.push({
      id: newId('log'),
      logDate: req.effectiveDate ? new Date(req.effectiveDate + 'T00:00:00').toISOString() : now,
      vicLicense: req.vehicleLicense,
      changeType: def.excelLogbookType,
      logFrom: req.logFrom,
      logTo: req.logTo,
      remark: req.remark,
      syncStatus: '未同步',
      sourceRequestId: req.id,
      createdAt: now,
    })
  }

  let vehicleSyncedAt: string | null = null
  if (shouldSync) {
    const fieldName = def.vehicleField
    if (!fieldName) throw new Error(`Change type "${def.id}" has no vehicleField`)
    const result = syncVehicleField(req.vehicleId, fieldName, (req.logTo ?? '').trim())
    if (!result.ok) {
      throw new Error(`Failed to update fleet record (${req.vehicleLicense} / ${fieldName}): ${result.error}`)
    }
    vehicleSyncedAt = now
  }

  req.status = STATUS_APPROVED
  req.approver = userId
  req.approvalTime = now
  req.approvalComment = approvalComment ?? null
  req.vehicleSyncedAt = vehicleSyncedAt
  req.updatedAt = now
  saveStore()
  return { id: req.id, status: req.status }
}

function reject(id: string, approvalComment: string, userId: string): { id: string; status: string } {
  if (!approvalComment || !approvalComment.trim()) throw new Error('A comment is required when rejecting')
  const req = getStore().changeRequests.find((r) => r.id === id)
  if (!req) throw new Error('Request not found')
  if (req.status !== STATUS_PENDING) throw new Error(`Request cannot be rejected in status "${req.status}"`)
  const now = new Date().toISOString()
  req.status = STATUS_REJECTED
  req.approver = userId
  req.approvalTime = now
  req.approvalComment = approvalComment.trim()
  req.updatedAt = now
  saveStore()
  return { id: req.id, status: req.status }
}

function batchApprove(ids: string[], approvalComment: string | undefined, userId: string): BatchApproveResult {
  const results: BatchApproveResult['results'] = []
  let successCount = 0
  let failCount = 0
  for (const id of ids) {
    try {
      approve(id, approvalComment, userId)
      results.push({ id, success: true })
      successCount += 1
    } catch (err) {
      results.push({ id, success: false, error: err instanceof Error ? err.message : String(err) })
      failCount += 1
    }
  }
  return { results, successCount, failCount }
}

function listFollowUps(): FollowUpItem[] {
  const offlineIds = CHANGE_TYPES.filter((d) => !d.writesLogbook).map((d) => d.id)
  return getStore().changeRequests
    .filter((r) => r.status === STATUS_APPROVED && offlineIds.includes(r.changeType) && !r.followUpCompletedAt)
    .sort((a, b) => (b.approvalTime ?? '').localeCompare(a.approvalTime ?? ''))
    .slice(0, 50)
    .map((r) => ({
      id: r.id,
      changeType: r.changeType,
      vehicleLicense: r.vehicleLicense,
      remark: r.remark,
      effectiveDate: r.effectiveDate,
      approvalTime: r.approvalTime,
      applicantName: userName(r.createdBy),
    }))
}

function markFollowUpsComplete(ids: string[]): MarkSyncedResult {
  const now = new Date().toISOString()
  let updatedCount = 0
  getStore().changeRequests.forEach((r) => {
    if (ids.includes(r.id) && r.status === STATUS_APPROVED && !r.followUpCompletedAt) {
      r.followUpCompletedAt = now
      r.updatedAt = now
      updatedCount += 1
    }
  })
  saveStore()
  return { updatedCount }
}

function listPendingLogbook(): PendingLogbookRow[] {
  const store = getStore()
  const approvedIds = new Set(store.changeRequests.filter((r) => r.status === STATUS_APPROVED).map((r) => r.id))
  const limit = todayEnd().getTime()
  return store.logbook
    .filter((l) => l.syncStatus === '未同步' && new Date(l.logDate).getTime() <= limit && approvedIds.has(l.sourceRequestId))
    .sort((a, b) => a.logDate.localeCompare(b.logDate) || a.createdAt.localeCompare(b.createdAt))
    .map((l) => ({
      id: l.id,
      logDate: formatLogbookDate(new Date(l.logDate)),
      vicLicense: l.vicLicense,
      changeType: l.changeType,
      logFrom: l.logFrom,
      logTo: l.logTo,
      remark: l.remark,
      isTestVehicle: false,
    }))
}

function markLogbookSynced(ids: string[]): MarkSyncedResult {
  let updatedCount = 0
  getStore().logbook.forEach((l) => {
    if (ids.includes(l.id) && l.syncStatus === '未同步') {
      l.syncStatus = '已同步'
      updatedCount += 1
    }
  })
  saveStore()
  return { updatedCount }
}

function pendingSyncRows(): StoredRequest[] {
  const limit = todayEnd().getTime()
  return getStore().changeRequests
    .filter((r) => {
      if (r.status !== STATUS_APPROVED || r.vehicleSyncedAt) return false
      const ts = effectiveTs(r.effectiveDate)
      if (ts === null || ts > limit) return false
      const def = getChangeType(r.changeType)
      return !!def && def.syncsVehicleField && !!def.vehicleField
    })
    .sort((a, b) => (a.effectiveDate ?? '').localeCompare(b.effectiveDate ?? '') || a.createdAt.localeCompare(b.createdAt))
}

function listPendingVehicleSync(): PendingVehicleSyncRow[] {
  return pendingSyncRows().map((r) => {
    const def = getChangeType(r.changeType)
    const v = findVehicle(r.vehicleId)
    return {
      id: r.id,
      vehicleLicense: r.vehicleLicense,
      changeType: r.changeType,
      logTo: r.logTo,
      effectiveDate: r.effectiveDate ?? '',
      currentBaseValue: v && def?.vehicleField ? vehicleFieldValue(v, def.vehicleField) : '(not found)',
    }
  })
}

function getSyncStatus(): SyncStatusResponse {
  const pendingCount = pendingSyncRows().length
  const synced = getStore().changeRequests
    .map((r) => r.vehicleSyncedAt)
    .filter((t): t is string => !!t)
    .sort()
  return { pendingCount, lastSyncedAt: synced.length ? synced[synced.length - 1] : null }
}

function executeVehicleSync(ids: string[]): ExecuteVehicleSyncResult {
  const results: ExecuteVehicleSyncResult['results'] = []
  let successCount = 0
  let failCount = 0
  for (const id of ids) {
    const req = getStore().changeRequests.find((r) => r.id === id)
    if (!req) { results.push({ id, success: false, error: 'Request not found' }); failCount += 1; continue }
    if (req.status !== STATUS_APPROVED) { results.push({ id, success: false, error: 'Request is not approved' }); failCount += 1; continue }
    if (req.vehicleSyncedAt) { results.push({ id, success: false, error: 'Request was already synced' }); failCount += 1; continue }
    const def = getChangeType(req.changeType)
    if (!def || !def.syncsVehicleField || !def.vehicleField) {
      results.push({ id, success: false, error: 'This change type does not write back to the fleet list' }); failCount += 1; continue
    }
    const r = syncVehicleField(req.vehicleId, def.vehicleField, (req.logTo ?? '').trim())
    if (!r.ok) { results.push({ id, success: false, error: r.error }); failCount += 1; continue }
    const now = new Date().toISOString()
    req.vehicleSyncedAt = now
    req.updatedAt = now
    results.push({ id, success: true })
    successCount += 1
  }
  saveStore()
  return { results, successCount, failCount }
}

// ---------------------------------------------------------------------------
// Parking locations
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function listParkingLocations(): ParkingLocationSummary[] {
  return [...DEMO_PARKING_LOCATIONS]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ id: p.id, name: p.name }))
}

function getParkingLocationDetail(id: string): ParkingLocationDetail {
  const p = DEMO_PARKING_LOCATIONS.find((s) => s.id === id)
  if (!p) throw new Error('Parking location not found')
  return { ...p }
}

function getParkedVehicles(id: string): { items: ParkedVehicleSummary[]; total: number } {
  const p = getParkingLocationDetail(id)
  const items = getStore().vehicles
    .filter((v) => normalize(v.parkingLocationName) === normalize(p.name))
    .map((v) => ({
      id: v.id,
      vicLicense: v.vicLicense,
      make: v.make,
      model: v.model,
      department: v.department,
      section: v.section,
    }))
  return { items, total: items.length }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

interface RequestOptions {
  params?: Record<string, string>
}

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
}

export async function handleRequest(
  method: HttpMethod,
  url: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResponse<unknown> | undefined> {
  await delay()
  const userId = DEMO_USER_ID
  const path = url.split('?')[0]
  const params = options?.params ?? {}
  const b = (body ?? {}) as Record<string, unknown>

  // auth / vehicles
  if (method === 'get' && path === '/api/auth/admin-check') return ok(checkAdmin())
  {
    const m = path.match(/^\/api\/vehicles\/([^/]+)$/)
    if (method === 'get' && m) {
      const v = findVehicle(decodeURIComponent(m[1]))
      if (!v) throw new Error('Vehicle record not found')
      return ok(toVehicleDetail(v, checkAdmin().isAdmin))
    }
  }

  // change requests (drafts)
  if (path === '/api/change-requests/drafts') {
    if (method === 'get') return ok(listDrafts(userId))
    if (method === 'post') return ok(createDraft(b as unknown as CreateDraftRequest, userId))
  }
  if (method === 'post' && path === '/api/change-requests/drafts/submit') {
    const count = submitDrafts((b.ids as string[]) ?? [], userId)
    return ok({ count }, `Submitted ${count} request(s)`)
  }
  {
    const m = path.match(/^\/api\/change-requests\/drafts\/([^/]+)$/)
    if (m) {
      const id = decodeURIComponent(m[1])
      if (method === 'patch') return ok(updateDraft(id, b as UpdateDraftRequest, userId))
      if (method === 'delete') { deleteDraft(id, userId); return undefined }
    }
  }

  // approval
  if (method === 'get' && path === '/api/approval/sync-status') return ok(getSyncStatus())
  if (method === 'get' && path === '/api/approval/requests') return ok(listRequests(params.status))
  if (method === 'get' && path === '/api/approval/my-requests') return ok(listMyRequests(userId))
  if (method === 'get' && path === '/api/approval/archive') return ok(listArchive(params as ArchiveQuery))
  if (method === 'get' && path === '/api/approval/follow-ups') return ok(listFollowUps())
  if (method === 'post' && path === '/api/approval/follow-ups/mark-complete') {
    const r = markFollowUpsComplete((b.ids as string[]) ?? [])
    return ok(r, `Marked ${r.updatedCount} item(s) as complete`)
  }
  if (method === 'get' && path === '/api/approval/logbook/pending') return ok(listPendingLogbook())
  if (method === 'post' && path === '/api/approval/logbook/mark-synced') {
    const r = markLogbookSynced((b.ids as string[]) ?? [])
    return ok(r, `Marked ${r.updatedCount} row(s) as synced`)
  }
  if (method === 'post' && path === '/api/approval/batch-approve') {
    const r = batchApprove((b.ids as string[]) ?? [], b.approvalComment as string | undefined, userId)
    return ok(r, `${r.successCount} succeeded, ${r.failCount} failed`)
  }
  if (method === 'get' && path === '/api/approval/pending-vehicle-sync') return ok(listPendingVehicleSync())
  if (method === 'post' && path === '/api/approval/execute-vehicle-sync') {
    const r = executeVehicleSync((b.ids as string[]) ?? [])
    return ok(r, `${r.successCount} succeeded, ${r.failCount} failed`)
  }
  {
    const m = path.match(/^\/api\/approval\/requests\/([^/]+)$/)
    if (method === 'patch' && m) return ok(editRequest(decodeURIComponent(m[1]), b as EditRequest, userId), 'Changes saved')
  }
  {
    const m = path.match(/^\/api\/approval\/approve\/([^/]+)$/)
    if (method === 'post' && m) return ok(approve(decodeURIComponent(m[1]), b.approvalComment as string | undefined, userId), 'Approved')
  }
  {
    const m = path.match(/^\/api\/approval\/reject\/([^/]+)$/)
    if (method === 'post' && m) return ok(reject(decodeURIComponent(m[1]), String(b.approvalComment ?? ''), userId), 'Rejected')
  }

  // parking locations
  if (method === 'get' && path === '/api/parking-locations') return ok({ items: listParkingLocations() })
  {
    const m = path.match(/^\/api\/parking-locations\/([^/]+)\/vehicles$/)
    if (method === 'get' && m) return ok(getParkedVehicles(decodeURIComponent(m[1])))
  }
  {
    const m = path.match(/^\/api\/parking-locations\/([^/]+)$/)
    if (method === 'get' && m) return ok(getParkingLocationDetail(decodeURIComponent(m[1])))
  }

  throw new Error(`No demo handler for ${method.toUpperCase()} ${path}`)
}

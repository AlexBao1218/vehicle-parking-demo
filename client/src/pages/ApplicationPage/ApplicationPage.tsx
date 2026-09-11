import { useState, useCallback, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, Car, Plus, Trash2, Edit, X, Send, FileText, Download } from 'lucide-react';
import { capabilityClient, logger, useCurrentUserProfile } from '@lark-apaas/client-toolkit';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getTextValue } from '@/data/vehicle';
import {
  listEnabledChangeTypes,
  getChangeType,
  getVehicleFieldName,
  isManualInputType,
} from '@shared/change-types';
import { Image as UIImage } from '@/components/ui/image';
import * as crApi from '@/api/change-requests';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { NOT_AVAILABLE_LABEL } from '@/lib/brand';

const VEHICLE_PLUGIN_ID = 'vehicle_list_draft_readonly_query_3';
const PARKING_PLUGIN_ID = 'parking_location_map_readonly_query_3';

// 變更類型的全部元信息（顯示名、Base 字段名、選項來源、是否手動輸入）現由
// shared/change-types.ts 統一定義，前後端共用同一份。原本此處的 CHANGE_TYPES /
// CHANGE_TYPE_FIELD_MAP / MANUAL_ONLY_TYPES 與後端各有一份副本，五份描述同一件事。
const ENABLED_CHANGE_TYPES = listEnabledChangeTypes();

// 規範化字段名：折疊空白與換行、忽略大小寫，用於穩健匹配 Base 返回記錄中的字段
function normalizeKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

// 先按精確字段名取值；取不到時按規範化後的字段名逐一匹配（解決大小寫 / 空格 / 換行差異導致讀空的問題）
function getFieldValueRobust(record: Record<string, unknown>, fieldName: string): unknown {
  if (fieldName in record) return record[fieldName];
  const target = normalizeKey(fieldName);
  for (const key of Object.keys(record)) {
    if (normalizeKey(key) === target) return record[key];
  }
  return undefined;
}

interface VehicleOption {
  id: string;
  vicLicense: string;
  make: string;
  model: string;
}

interface DraftRecord {
  id: string;
  vehicleId: string;
  vehicleLicense: string;
  changeType: string;
  logFrom: string;
  logTo: string;
  effectiveDate: string;
  effectiveDateTs: number | null;
  remark: string;
  attachments: AttachmentInfo[];
  applyTime: string;
  status: string;
  isLegacy?: boolean;
}

interface AttachmentInfo {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface ParsedAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

function parseAttachments(raw: unknown): AttachmentInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a: unknown) => a && typeof a === 'object' && 'name' in (a as object) && 'url' in (a as object))
    .map((a: unknown) => {
      const o = a as ParsedAttachment;
      return { name: o.name, url: o.url, type: o.type, size: o.size };
    });
}

function isImageAttachment(att: AttachmentInfo): boolean {
  return att.type.startsWith('image/');
}

export default function ApplicationPage() {
  const profile = useCurrentUserProfile();
  const currentUserId = profile?.user_id ?? '';

  // 車輛搜索
  const [searchKeyword, setSearchKeyword] = useState('');
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);

  // 表單
  const [changeType, setChangeType] = useState('');
  const [logFrom, setLogFrom] = useState('');
  const [logTo, setLogTo] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [remark, setRemark] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentInfo[]>([]);

  // Log-From / Log-To 下拉選項
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [logFromMode, setLogFromMode] = useState<'dropdown' | 'manual'>('dropdown');
  const [logToMode, setLogToMode] = useState<'dropdown' | 'manual'>('dropdown');
  const [loadingOptions, setLoadingOptions] = useState(false);

  // 競態保護：每次刷新選項時遞增；遲到的舊請求結果一律作廢
  const fieldReqIdRef = useRef(0);

  // 草稿
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // 清空草稿確認
  const [clearDraftsOpen, setClearDraftsOpen] = useState(false);

  // 批量提交
  const [submittingAll, setSubmittingAll] = useState(false);

  // 停車場位置快取
  const parkingLocationsRef = useRef<string[]>([]);
  const parkingLoadedRef = useRef(false);

  // writesLogbook === false 的類型（補領類、其他；由註冊表派生，禁止硬編碼類型 id）：
  // 無 Log-From / Log-To 概念，描述（Remark）即申請內容，必填多行框；提交時 Log-From / Log-To 傳空串
  const isOfflineRequest = getChangeType(changeType)?.writesLogbook === false;

  // 圖片預覽

  // ========== 車輛搜索 ==========
  const handleSearch = useCallback(async (keyword: string) => {
    setSearchKeyword(keyword);
    if (keyword.trim().length < 2) {
      setVehicles([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    setShowDropdown(true);
    try {
      const result = await capabilityClient.load(VEHICLE_PLUGIN_ID).call<{
        records: Array<{ id: string; record: Record<string, unknown> }>;
        hasMore: boolean;
      }>('searchRecords', {
        filter: {
          conjunction: 'and',
          conditions: [{ fieldName: 'VicLicense', operator: 'contains', value: [keyword.trim()] }],
        },
        fieldNames: ['VicLicense', 'Make', 'Model'],
        pageSize: 10,
      });
      const opts: VehicleOption[] = (result.records || []).map((r) => ({
        id: r.id,
        vicLicense: getTextValue(r.record['VicLicense']),
        make: getTextValue(r.record['Make']),
        model: getTextValue(r.record['Model']),
      }));
      setVehicles(opts);
    } catch (err) {
      logger.error('Search vehicles failed:', String(err));
      setVehicles([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // ========== 加載停車場地點列表 ==========
  const loadParkingLocations = useCallback(async () => {
    if (parkingLoadedRef.current) return parkingLocationsRef.current;
    try {
      const result = await capabilityClient.load(PARKING_PLUGIN_ID).call<{
        records: Array<{ id: string; record: Record<string, unknown> }>;
        hasMore: boolean;
      }>('searchRecords', {
        fieldNames: ['Location'],
        pageSize: 50,
      });
      const locations = (result.records || [])
        .map((r) => getTextValue(r.record['Location']).trim())
        .filter(Boolean);
      parkingLocationsRef.current = locations;
      parkingLoadedRef.current = true;
      return locations;
    } catch (err) {
      logger.error('Load parking locations failed:', String(err));
      return [];
    }
  }, []);

  // ========== 讀取某字段的全部去重取值（返回結果，不直接改 state） ==========
  const fetchFieldOptionValues = useCallback(async (displayType: string): Promise<string[]> => {
    const def = getChangeType(displayType);
    if (!def) {
      logger.error('未登記的變更類型:', displayType);
      return [];
    }
    if (def.optionSource === 'parkingLocation') {
      return await loadParkingLocations();
    }
    if (def.optionSource !== 'vehicleFieldDistinct' || !def.vehicleField) {
      // manual / parkingSpace：候選值不來自車輛表該列
      return [];
    }
    const fieldName = def.vehicleField;
    const result = await capabilityClient.load(VEHICLE_PLUGIN_ID).call<{
      records: Array<{ id: string; record: Record<string, unknown> }>;
      hasMore: boolean;
    }>('searchRecords', {
      fieldNames: [fieldName],
      pageSize: 500,
    });
    const seen = new Set<string>();
    const values: string[] = [];
    for (const r of result.records || []) {
      const val = getTextValue(getFieldValueRobust(r.record, fieldName)).trim();
      if (val && !seen.has(val)) {
        seen.add(val);
        values.push(val);
      }
    }
    return values.sort();
  }, [loadParkingLocations]);

  // ========== 讀取車輛某字段當前值（字段名穩健匹配） ==========
  const fetchVehicleFieldValue = useCallback(async (vehicleId: string, displayType: string): Promise<string> => {
    if (!vehicleId || !displayType) return '';
    try {
      const fieldName = getVehicleFieldName(displayType);
      if (!fieldName) return '';
      const result = await capabilityClient.load(VEHICLE_PLUGIN_ID).call<{
        record?: Record<string, unknown>;
      }>('getRecord', {
        recordID: vehicleId,
      });
      if (result.record) {
        return getTextValue(getFieldValueRobust(result.record, fieldName)).trim();
      }
    } catch (err) {
      logger.error('Fetch vehicle field value failed:', String(err));
    }
    return '';
  }, []);

  // ========== 核心：切換變更類型 / 車輛後，統一刷新 Log-From 上下文 ==========
  // 一次完成：清空舊選項 → 並發取「選項列表 + 當前值」 → 整體替換（絕不與舊選項合併）
  // presetFrom / presetTo：編輯草稿時傳入，保留草稿原值不被當前值覆蓋
  const refreshFieldContext = useCallback(async (
    displayType: string,
    vehicleId: string,
    presetFrom?: string,
    presetTo?: string,
  ) => {
    const reqId = ++fieldReqIdRef.current;

    // writesLogbook === false 的類型無 Log-From / Log-To 上下文，跳過選項與當前值加載
    if (getChangeType(displayType)?.writesLogbook === false) {
      setFieldOptions([]);
      setLogFrom(presetFrom ?? '');
      setLoadingOptions(false);
      return;
    }

    // 立即清空上一個類型的殘留選項
    setFieldOptions([]);
    setLogFrom(presetFrom ?? '');
    setLogFromMode('dropdown');
    setLogToMode('dropdown');
    setLoadingOptions(true);

    try {
      const [options, currentVal] = await Promise.all([
        fetchFieldOptionValues(displayType),
        presetFrom !== undefined
          ? Promise.resolve(presetFrom)
          : fetchVehicleFieldValue(vehicleId, displayType),
      ]);

      // 期間用戶又切換了類型或車輛：本次結果作廢
      if (reqId !== fieldReqIdRef.current) return;

      const merged = [...options];
      if (currentVal && !merged.includes(currentVal)) merged.unshift(currentVal);
      if (presetTo && !merged.includes(presetTo)) merged.push(presetTo);

      logger.info(
        '[DEBUG] refreshFieldContext:', displayType,
        '| options:', merged.length,
        '| currentVal:', currentVal || '(empty)',
      );

      setFieldOptions(merged);
      setLogFrom(currentVal);
    } catch (err) {
      if (reqId !== fieldReqIdRef.current) return;
      logger.error('refreshFieldContext failed:', String(err));
      setFieldOptions([]);
    } finally {
      if (reqId === fieldReqIdRef.current) setLoadingOptions(false);
    }
  }, [fetchFieldOptionValues, fetchVehicleFieldValue]);

  // ========== 選擇車輛 ==========
  const handleSelectVehicle = useCallback((v: VehicleOption) => {
    setSelectedVehicle(v);
    setSearchKeyword(v.vicLicense);
    setShowDropdown(false);
    setLogTo('');

    if (changeType && !isManualInputType(changeType)) {
      // 已選了類型：換車後立即按新車刷新當前值與選項
      refreshFieldContext(changeType, v.id);
    } else if (changeType) {
      // 手動輸入類型：保持手動模式，清空舊值
      setLogFrom('');
    } else {
      setLogFrom('');
      setFieldOptions([]);
      setLogFromMode('dropdown');
      setLogToMode('dropdown');
    }
  }, [changeType, refreshFieldContext]);

  // ========== 切換變更類型 ==========
  const handleChangeTypeChange = useCallback((type: string) => {
    setChangeType(type);
    setLogTo('');

    if (isManualInputType(type)) {
      fieldReqIdRef.current++; // 作廢進行中的選項加載
      setFieldOptions([]);
      setLogFrom('');
      setLogFromMode('manual');
      setLogToMode('manual');
      setLoadingOptions(false);
      return;
    }

    if (selectedVehicle && type) {
      refreshFieldContext(type, selectedVehicle.id);
    } else {
      setFieldOptions([]);
      setLogFrom('');
      setLogFromMode('dropdown');
      setLogToMode('dropdown');
    }
  }, [selectedVehicle, refreshFieldContext]);

  // ========== 草稿列表 ==========
  const fetchDrafts = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingDrafts(true);
    try {
      logger.info('[DEBUG] fetchDrafts: calling API');
      const res = await crApi.fetchDrafts();
      const rawDrafts = (res.success ? res.data : []) as unknown as DraftRecord[];
      logger.info('[DEBUG] fetchDrafts result:', rawDrafts.length, '条', rawDrafts.length > 0 ? JSON.stringify({ status: rawDrafts[0].status, vehicleId: rawDrafts[0].vehicleId }) : 'empty');

      const vehicleIds = [...new Set(rawDrafts.map((d) => d.vehicleId).filter(Boolean))];
      const licenseMap = new Map<string, string>();

      if (vehicleIds.length > 0) {
        try {
          const vResults = await Promise.all(
            vehicleIds.map((vid: string) =>
              capabilityClient.load(VEHICLE_PLUGIN_ID).call<{
                id: string;
                record: { VicLicense?: { text?: string } };
              }>('getRecord', { recordID: vid })
                .then((r) => ({ id: r.id, text: r.record?.VicLicense?.text ?? '' }))
                .catch(() => ({ id: vid, text: '' }))
            )
          );
          for (const vr of vResults) {
            licenseMap.set(vr.id, vr.text);
          }
        } catch { /* ignore */ }
      }

      const mapped: DraftRecord[] = rawDrafts.map((d) => ({
        ...d,
        vehicleLicense: licenseMap.get(d.vehicleId) ?? d.vehicleLicense,
      }));
      if (mapped.length > 0) {
        logger.info('[DEBUG] att-6 first draft attachments:', JSON.stringify(mapped[0].attachments));
      }
      setDrafts(mapped);
    } catch (err) {
      const errMsg = String(err);
      logger.error('[DEBUG] fetchDrafts error:', errMsg);
      const reason = errMsg.includes('open platform error:') ? errMsg.split('open platform error:')[1].trim() : errMsg;
      toast.error(`Failed to load drafts: ${reason}`);
    } finally {
      setLoadingDrafts(false);
    }
  }, [currentUserId]);

  // ==========
  useEffect(() => {
    if (currentUserId) {
      fetchDrafts();
    }
  }, [currentUserId, fetchDrafts]);

  // 版本標記：Console 中出現此日誌即代表本版代碼已部署
  useEffect(() => {
    logger.info('[DEBUG] ApplicationPage build: v4-span-display');
  }, []);

  // ========== 附件處理 ==========
  const handleAttachmentChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // ========== 加入清單 ==========
  const resetForm = useCallback(() => {
    fieldReqIdRef.current++; // 作廢進行中的選項加載
    setChangeType('');
    setLogFrom('');
    setLogTo('');
    setEffectiveDate('');
    setRemark('');
    setAttachments([]);
    setExistingAttachments([]);
    setFieldOptions([]);
    setLogFromMode('dropdown');
    setLogToMode('dropdown');
    setLoadingOptions(false);
    setEditingDraftId(null);
  }, []);

  const handleAddToDraft = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) {
      toast.error('Please select a vehicle first');
      return;
    }
    if (!changeType) {
      toast.error('Please select a change type');
      return;
    }
    if (isOfflineRequest) {
      // 無 Log-From / Log-To，描述即申請內容，必填（補領類與其他統一規則）
      if (!remark.trim()) {
        toast.error('Please enter a description');
        return;
      }
    } else if (!logTo.trim()) {
      toast.error('Please enter Log-To');
      return;
    }

    setAdding(true);
    try {
      logger.info('[DEBUG] att-1 files:', attachments.length);

      // File storage lived in the platform's bucket service (dataloom); the public demo
      // keeps the picker and previews but does not persist uploads.
      const uploadedAttachments: { name: string; url: string; type: string; size: number }[] = [];
      if (attachments.length > 0) {
        toast.info(`${NOT_AVAILABLE_LABEL}: attachments are not saved`);
      }

      const payload = {
        changeType,
        vehicleId: selectedVehicle.id,
        vehicleLicense: selectedVehicle.vicLicense,
        logFrom: isOfflineRequest ? '' : logFrom,
        logTo: isOfflineRequest ? '' : logTo.trim(),
        effectiveDate: effectiveDate || null,
        remark: isOfflineRequest ? remark.trim() : remark,
        attachments: [...existingAttachments, ...uploadedAttachments],
      };
      logger.info('[DEBUG] att-4 payload.attachments:', JSON.stringify(payload.attachments));

      if (editingDraftId) {
        await crApi.updateDraft(editingDraftId, payload);
        toast.success('Draft updated');
      } else {
        await crApi.createDraft(payload);
        toast.success('Added to pending list');
      }

      resetForm();
      fetchDrafts();
    } catch (err) {
      const errMsg = String(err);
      logger.error('Add to draft failed:', errMsg);
      const reason = errMsg.includes('open platform error:') ? errMsg.split('open platform error:')[1].trim() : errMsg;
      toast.error(`Operation failed: ${reason}`);
    } finally {
      setAdding(false);
    }
  }, [selectedVehicle, changeType, isOfflineRequest, logFrom, logTo, effectiveDate, remark, attachments, editingDraftId, resetForm, fetchDrafts]);

  // ========== 編輯草稿 ==========
  const handleEditDraft = useCallback((draft: DraftRecord) => {
    setSelectedVehicle({
      id: draft.vehicleId,
      vicLicense: draft.vehicleLicense,
      make: '',
      model: '',
    });
    setSearchKeyword(draft.vehicleLicense);
    setChangeType(draft.changeType);
    setLogTo(draft.logTo);
    setEffectiveDate(draft.effectiveDateTs ? new Date(draft.effectiveDateTs).toISOString().slice(0, 10) : '');
    setRemark(draft.remark);
    setAttachments([]);
    setExistingAttachments(draft.attachments ?? []);
    setEditingDraftId(draft.id);

    if (isManualInputType(draft.changeType)) {
      fieldReqIdRef.current++;
      setFieldOptions([]);
      setLogFrom(draft.logFrom);
      setLogFromMode('manual');
      setLogToMode('manual');
      setLoadingOptions(false);
    } else {
      // 保留草稿原本的 Log-From / Log-To，同時載入該類型的選項供修改
      refreshFieldContext(draft.changeType, draft.vehicleId, draft.logFrom, draft.logTo);
    }

    // 滾動到表單
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [refreshFieldContext]);

  // ========== 刪除草稿 ==========
  const handleDeleteDraft = useCallback(async (id: string) => {
    try {
      await crApi.deleteDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      toast.success('Draft deleted');
    } catch (err) {
      const errMsg = String(err);
      logger.error('Delete draft failed:', errMsg);
      const reason = errMsg.includes('open platform error:') ? errMsg.split('open platform error:')[1].trim() : errMsg;
      toast.error(`Delete failed: ${reason}`);
    }
  }, []);

  // ========== 全部提交 ==========
  const handleSubmitAll = useCallback(async () => {
    if (drafts.length === 0) {
      toast.error('No drafts to submit');
      return;
    }
    setSubmittingAll(true);
    try {
      const ids = drafts.map((d) => d.id);
      logger.info('[DEBUG] submitAll payload:', JSON.stringify({ ids, count: ids.length }));
      const res = await crApi.submitDrafts(ids);
      if (res.success) {
        toast.success(`Submitted ${res.data.count} request(s), pending approval`);
        setDrafts([]);
      } else {
        toast.error(res.message || 'Submission failed');
      }
    } catch (err) {
      const errMsg = String(err);
      logger.error('[DEBUG] submitAll error:', errMsg);
      const reason = errMsg.includes('open platform error:') ? errMsg.split('open platform error:')[1].trim() : errMsg;
      toast.error(`Submission failed: ${reason}`);
    } finally {
      setSubmittingAll(false);
    }
  }, [drafts]);

  // ========== 清空草稿 ==========
  const handleClearDrafts = useCallback(async () => {
    if (drafts.length === 0) return;
    try {
      await Promise.all(drafts.map((d) => crApi.deleteDraft(d.id)));
      setDrafts([]);
      toast.success('All drafts cleared');
    } catch (err) {
      const errMsg = String(err);
      logger.error('Clear drafts failed:', errMsg);
      const reason = errMsg.includes('open platform error:') ? errMsg.split('open platform error:')[1].trim() : errMsg;
      toast.error(`Failed to clear drafts: ${reason}`);
    } finally {
      setClearDraftsOpen(false);
    }
  }, [drafts]);

  // ========== 渲染輔助 ==========
  const renderFieldValueSelector = (
    mode: 'dropdown' | 'manual',
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    id: string,
  ) => {
    if (mode === 'manual') {
      return (
        <div className="space-y-1">
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full"
          />
          <button
            type="button"
            onClick={() => {
              if (id === 'logFrom') {
                setLogFromMode('dropdown');
              } else {
                setLogToMode('dropdown');
              }
            }}
            className="text-xs text-primary hover:underline"
          >
             Back to dropdown options
          </button>
        </div>
      );
    }

    return (
      <Select
        key={`${id}-${changeType}-${selectedVehicle?.id ?? 'none'}-${value}`}
        value={value || ''}
        onValueChange={(v) => {
          if (v === '__other__') {
            if (id === 'logFrom') {
              setLogFromMode('manual');
            } else {
              setLogToMode('manual');
            }
            onChange('');
          } else {
            onChange(v);
          }
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <span className={value ? 'truncate text-left' : 'truncate text-left text-muted-foreground'}>
            {value || (loadingOptions ? 'Loading options...' : placeholder)}
          </span>
        </SelectTrigger>
        <SelectContent>
          {fieldOptions.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
          <SelectItem value="__other__">Other (manual input)</SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const renderAttachments = (atts: AttachmentInfo[]) => {
    if (atts.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-1">
        {atts.map((att, i) => (
          <UniversalLink
            key={i}
            to={att.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-muted/50 hover:bg-muted transition-colors text-xs text-foreground"
            title={att.name}
          >
            {isImageAttachment(att) ? (
              <UIImage
                src={att.url}
                alt={att.name}
                className="size-5 rounded object-cover"
              />
            ) : (
              <FileText className="size-4 text-muted-foreground" />
            )}
            <span className="max-w-[120px] truncate">{att.name}</span>
            <Download className="size-3 text-muted-foreground shrink-0" />
          </UniversalLink>
        ))}
      </div>
    );
  };

  const remarkSummary = (r: { remark: string; attachments: AttachmentInfo[] }) => {
    let text = r.remark ? (r.remark.length > 30 ? r.remark.slice(0, 30) + '...' : r.remark) : '';
    if (r.attachments.length > 0) {
      text = (text ? text + ' ' : '') + '📎' + r.attachments.length;
    }
    return text || '-';
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground">Vehicle Change Request</h2>
        </div>

        {/* ===== 表單 ===== */}
        <form onSubmit={handleAddToDraft} noValidate className="space-y-6">
          {editingDraftId && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Edit className="size-4" />
              Editing draft
              <button
                type="button"
                onClick={() => { resetForm(); setSelectedVehicle(null); setSearchKeyword(''); setVehicles([]); }}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                Cancel Edit
              </button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Vehicle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedVehicle ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50">
                  <Car className="size-4 text-primary" />
                  <span className="font-medium">{selectedVehicle.vicLicense}</span>
                  <span className="text-muted-foreground text-sm">
                    {selectedVehicle.make} {selectedVehicle.model}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSelectedVehicle(null); setSearchKeyword(''); setVehicles([]); resetForm(); }}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => handleSearch(e.target.value)}
                      onFocus={() => { if (vehicles.length > 0) setShowDropdown(true); }}
                      onBlur={() => { setTimeout(() => setShowDropdown(false), 200); }}
                       placeholder="Enter license plate to search"
                      className="pl-9"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                    {showDropdown && vehicles.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                        {vehicles.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onMouseDown={() => handleSelectVehicle(v)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                          >
                            <Car className="size-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <span className="font-medium text-foreground">{v.vicLicense}</span>
                              <span className="text-muted-foreground text-xs ml-2">
                                {v.make} {v.model}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showDropdown && vehicles.length === 0 && !searching && searchKeyword.trim().length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg p-4 text-center">
                         <p className="text-muted-foreground text-sm">License plate not found. Please check the input or contact the Transport Team</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Change Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 md:w-1/2">
                 <Label htmlFor="changeType">Change Type *</Label>
                <Select value={changeType} onValueChange={handleChangeTypeChange}>
                  <SelectTrigger id="changeType" className="w-[391px]">
                    <SelectValue placeholder="Select change type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENABLED_CHANGE_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isOfflineRequest && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="logFrom">Log-From (current value)</Label>
                    {renderFieldValueSelector(logFromMode, logFrom, setLogFrom, '', 'logFrom')}
                    {loadingOptions && !logFrom && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        Loading options...
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logTo">Log-To (new value) *</Label>
                    {renderFieldValueSelector(logToMode, logTo, setLogTo, '', 'logTo')}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="effectiveDate">{isOfflineRequest ? 'Expected Date' : 'Effective Date'}</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remark">{isOfflineRequest ? 'Description *' : 'Remark'}</Label>
                <Textarea
                  id="remark"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                   placeholder={isOfflineRequest ? 'Describe what you are requesting and why' : 'Additional notes (optional)'}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="flex flex-wrap gap-2">
                  {existingAttachments.map((att, i) => (
                    <div key={`existing-${i}`} className="relative group size-16 rounded-md overflow-hidden border border-border">
                      {att.type.startsWith('image/') ? (
                        <UIImage
                          src={att.url}
                          alt={att.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <UniversalLink to={att.url} target="_blank" rel="noopener noreferrer" className="size-full flex items-center justify-center bg-accent">
                          <FileText className="size-6 text-muted-foreground" />
                        </UniversalLink>
                      )}
                      <button
                        type="button"
                        onClick={() => setExistingAttachments((prev) => prev.filter((_, j) => j !== i))}
                        className="!absolute -right-1 -top-1 z-20 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  {attachments.map((file, i) => (
                    <div key={i} className="relative group size-16 rounded-md overflow-hidden border border-border">
                      <UIImage
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="!absolute -right-1 -top-1 z-20 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  <label className="size-16 rounded-md border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                    <Plus className="size-5 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAttachmentChange}
                    />
                  </label>
                </div>
                {isOfflineRequest && (
                   <p className="text-xs text-muted-foreground">You can upload supporting photos or documents.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            {editingDraftId && (
              <Button type="button" variant="outline" size="lg" onClick={() => { resetForm(); setSelectedVehicle(null); setSearchKeyword(''); setVehicles([]); }}>
                Cancel Edit
              </Button>
            )}
            <Button type="submit" size="lg" disabled={adding || !selectedVehicle}>
              {adding ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                   Processing...
                </>
              ) : editingDraftId ? (
                <>
                  <Edit className="size-4 mr-2" />
                   Update Draft
                </>
              ) : (
                <>
                  <Plus className="size-4 mr-2" />
                   Add to List
                </>
              )}
            </Button>
          </div>
        </form>

        {/* ===== 待提交清單 ===== */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Pending Submission</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {drafts.length} draft(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {loadingDrafts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : drafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="size-8 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">No drafts to submit</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap text-center">License Plate</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Change Type</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Log-From → Log-To</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Effective Date</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Remark</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drafts.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium whitespace-nowrap text-center px-3">
                          {d.vehicleLicense || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center px-3">{getChangeType(d.changeType)?.label ?? d.changeType}</TableCell>
                        <TableCell className="whitespace-nowrap text-center px-3">
                          <span className="text-muted-foreground">{d.logFrom || '-'}</span>
                          <span className="mx-1">→</span>
                          <span className="text-primary">{d.logTo}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center px-3">{d.effectiveDate || '-'}</TableCell>
                        <TableCell className="max-w-[160px] text-center px-3">
                          <span className="block truncate">{remarkSummary(d)}</span>
                          {renderAttachments(d.attachments)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center px-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditDraft(d)}
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDraft(d.id)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {drafts.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#e3e5e800]">
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSubmitAll}
                  disabled={submittingAll}
                >
                  {submittingAll ? (
                    <Loader2 className="size-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="size-4 mr-1" />
                  )}
                  Submit All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClearDraftsOpen(true)}
                >
                  <Trash2 className="size-4 mr-1" />
                  Clear Drafts
                </Button>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* 清空草稿確認 */}
      <AlertDialog open={clearDraftsOpen} onOpenChange={setClearDraftsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all drafts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all {drafts.length} draft record(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearDrafts} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
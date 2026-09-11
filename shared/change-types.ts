/**
 * 變更類型註冊表 —— 2.0 第 0 階段地基
 *
 * 本文件是「一個變更類型意味著什麼」的唯一事實來源。1.0 時期這些信息散落在三處：
 *   - client/.../ApplicationPage.tsx 的 CHANGE_TYPES（下拉選項）
 *   - client & server 各一份 CHANGE_TYPE_FIELD_MAP（顯示名 → Base 字段名）
 *   - client & server 各一份 MANUAL_ONLY_TYPES（哪些類型不查選項 / 不寫回）
 * 五份定義描述同一件事，加一個類型要改五處，漏一處就是靜默失效。現全部收編至此。
 *
 * ── 兩個分流布爾（第十章「混合主權」的落地形式）─────────────────────
 *
 *   writesLogbook      批准時是否生成 Logbook 行 == 這條變更最終是否要回到 Excel
 *   syncsVehicleField  批准時是否自動寫回 Base 車輛表對應字段
 *
 * 為什麼不是一個布爾：現有的「其他 / Remark on change (with date)」正好落在中間檔
 * —— 要進 Logbook 由人工搬進 Excel，但值是自由文本、無法從既有取值枚舉，不自動寫回
 * 車輛表。而 2.0 的補領油卡是兩者皆否。一個布爾表達不了三檔。
 *
 *   類型                        writesLogbook  syncsVehicleField
 *   Department 等 11 類              true            true
 *   其他 / Remark on change          true            false
 *   補領油卡 / 車位編號               false           false
 *
 * 不變式：syncsVehicleField ⇒ writesLogbook。違反時模塊加載即拋錯（見文件末尾），
 * 因為「不進 Excel 卻改了 Base 車輛表」會讓兩邊數據永久分叉且無人察覺。
 *
 * ── 名字的三處出口 ────────────────────────────────────────────
 *
 *   id                 存進 change_requests.change_type 的字符串，存量數據的錨點，勿改
 *   vehicleField       Base 車輛表的真實字段名，含全部歷史包袱（換行、雙空格、小寫）
 *   excelLogbookType   寫進 Excel Logbook「Type」列的值，宏認的就是它
 *
 * vehicleField 與 excelLogbookType 目前多數等於 id，但交接文檔第八章第 1 條尚未確認：
 * 歷史 Logbook 的 Type 取值（Operation Cost Centre / Operation CC 混用等）與本表對不上。
 * 拆成獨立字段後，確認宏的輸入契約時只需改本表對應行，不觸碰任何邏輯。
 */

/** 申請的業務歸類，用於申請頁分組與申請檔案檢索 */
export type ChangeTypeCategory =
  | 'vehicleChange'    // 車輛字段變更（1.0 全部類型）
  | 'personnelChange'  // 人員變更，一條申請展開成 N 條車輛級記錄（需求 C，未實現）
  | 'supplyRequest'    // 物品補領（需求 C，未實現）
  | 'parkingSpace';    // 車位分配（需求 A，未實現）

/** Log-From / Log-To 候選值從哪裡來 */
export type OptionSource =
  | 'vehicleFieldDistinct'  // 車輛表該列的去重取值
  | 'parkingLocation'       // Parking Location & Map 表的地點列表
  | 'parkingSpace'          // 車位表（需求 A，未實現）
  | 'manual';               // 直接手動輸入，不查選項

/**
 * 「寫飛書自有表」這第三類動作的處理器鍵名。
 * 本階段只登記、不實現：批准邏輯遇到帶 handler 的類型會直接拋錯，
 * 而不是靜默通過。這個項目已被靜默失敗咬過兩次（寫插件字段映射為空、
 * syncStatus 語義混淆），不再留「批准成功但什麼都沒發生」的口子。
 */
export type SideEffectHandler =
  | 'supplyIssue'        // 物品補領存檔
  | 'parkingSpaceAssign'; // 車位歸屬變更

export interface ChangeTypeDef {
  /** 穩定標識，存進 change_requests.change_type。改動即等於存量數據遷移 */
  id: string;
  /** 前端下拉顯示名（英文顯示名，僅用於顯示） */
  label: string;
  category: ChangeTypeCategory;
  /** false = 前端下拉不顯示，且後端在建草稿 / 改草稿 / 提交三處一律拒收 */
  enabled: boolean;
  /** 批准時是否生成 Logbook 行（是否最終要回 Excel） */
  writesLogbook: boolean;
  /** 批准時是否自動寫回 Base 車輛表 */
  syncsVehicleField: boolean;
  /** Base 車輛表真實字段名；不對應任何車輛字段時為 null */
  vehicleField: string | null;
  /** 寫進 Excel Logbook「Type」列的值 */
  excelLogbookType: string;
  optionSource: OptionSource;
  /** 目標飛書自有表標識（第三類動作預留，本階段無實現） */
  targetTable?: string;
  /** 副作用處理器；存在即表示尚未實現，批准時拋錯 */
  handler?: SideEffectHandler;
}

/** 車輛字段變更的公共形狀：進 Logbook、自動寫回、選項取自該列去重值 */
function vehicleFieldChange(
  id: string,
  vehicleField: string = id,
): ChangeTypeDef {
  return {
    id,
    label: id,
    category: 'vehicleChange',
    enabled: true,
    writesLogbook: true,
    syncsVehicleField: true,
    vehicleField,
    excelLogbookType: id,
    optionSource: 'vehicleFieldDistinct',
  };
}

export const CHANGE_TYPES: readonly ChangeTypeDef[] = [
  // ── 1.0 既有類型，行為與改造前完全一致 ──────────────────────
  vehicleFieldChange('Transport Coordinator'),
  vehicleFieldChange('Department'),
  vehicleFieldChange('Section'),
  vehicleFieldChange('Company'),
  {
    ...vehicleFieldChange('Parking Location'),
    // 選項來自 Parking Location & Map 表的地點列表，而非車輛表該列的去重值
    optionSource: 'parkingLocation',
  },

  // ── 已下線的 1.0 類型（2026-09 收窄至 6 類）：只關閉 enabled、條目保留，
  //    存量記錄仍可渲染與審批；新申請在建草稿/改草稿/提交三處被
  //    isSubmittableChangeType 攔截，檔案篩選用 listAllChangeTypes 全量列出
  { ...vehicleFieldChange('Status'), enabled: false },
  { ...vehicleFieldChange('Colour'), enabled: false },
  // 字段名裡 t 是小寫，不是 Fuel Type
  { ...vehicleFieldChange('Fuel type'), enabled: false },
  { ...vehicleFieldChange('Veh. Class'), enabled: false },
  { ...vehicleFieldChange('Make'), enabled: false },
  { ...vehicleFieldChange('Model'), enabled: false },

  // ── 1.0 的中間檔：進 Logbook 但不自動寫回 ────────────────────
  {
    id: 'Remark on change (with date)',
    label: 'Remark on change (with date)',
    category: 'vehicleChange',
    enabled: false,
    writesLogbook: true,
    // 該列是累加性備註文本，直接覆蓋會丟失歷史記錄，維持 1.0 的人工處理
    syncsVehicleField: false,
    vehicleField: 'Remark on change (with date)',
    excelLogbookType: 'Remark on change (with date)',
    optionSource: 'manual',
  },
  // ── 2.0 物品補領：批准後僅系統內留檔，不進 Logbook、不寫 Base ──
  // 無需副作用處理器，故不帶 handler；批准邏輯靠 writesLogbook/syncsVehicleField
  // 兩個 false 自然分流，剩餘動作僅狀態更新。
  {
    id: 'Fuel Card Reissue',
    label: 'Fuel Card Reissue',
    category: 'supplyRequest',
    enabled: true,
    writesLogbook: false,
    syncsVehicleField: false,
    vehicleField: null,
    excelLogbookType: '',
    optionSource: 'manual',
    targetTable: 'supply_requests',
  },
  {
    id: 'Ignition Card Reissue',
    label: 'Ignition Card Reissue',
    category: 'supplyRequest',
    enabled: true,
    writesLogbook: false,
    syncsVehicleField: false,
    vehicleField: null,
    excelLogbookType: '',
    optionSource: 'manual',
    targetTable: 'supply_requests',
  },
  {
    id: 'Vehicle Key Reissue',
    label: 'Vehicle Key Reissue',
    category: 'supplyRequest',
    enabled: true,
    writesLogbook: false,
    syncsVehicleField: false,
    vehicleField: null,
    excelLogbookType: '',
    optionSource: 'manual',
    targetTable: 'supply_requests',
  },
  {
    id: 'Parking Space Assignment',
    label: 'Parking Space Assignment',
    category: 'parkingSpace',
    enabled: false,
    writesLogbook: false,
    syncsVehicleField: false,
    // Fleet List 裡沒有車位編號一列，該數據主權在飛書（第十章）
    vehicleField: null,
    excelLogbookType: '',
    optionSource: 'parkingSpace',
    targetTable: 'parking_spaces',
    handler: 'parkingSpaceAssign',
  },

  // ── 「其他」：自由文本的線下跟進事項，不影響車輛檔、不進 Logbook，
  //    批准後與補領申請一起進入 After Approval 的 Follow-up 欄。
  //    置於數組末尾，類型下拉按數組順序渲染、Other 墊底
  {
    id: '其他',
    label: 'Other',
    category: 'vehicleChange',
    enabled: true,
    writesLogbook: false,
    syncsVehicleField: false,
    // 不對應任何固定車輛字段，申請人在描述裡自行說明
    vehicleField: null,
    excelLogbookType: '',
    optionSource: 'manual',
  },
];

// ============================================================
// 不變式校驗：違反時模塊加載即失敗，讓錯誤在啟動時暴露而非上線後
// ============================================================

function assertRegistryInvariants(defs: readonly ChangeTypeDef[]): void {
  const seen = new Set<string>();

  for (const d of defs) {
    const at = `變更類型「${d.id}」`;

    if (!d.id.trim()) {
      throw new Error('變更類型註冊表：存在空的 id');
    }
    if (seen.has(d.id)) {
      throw new Error(`變更類型註冊表：${at} 重複登記`);
    }
    seen.add(d.id);

    // 核心不變式：改了 Base 車輛表卻不留 Logbook，等於變更永遠回不到 Excel，
    // 兩邊數據從此分叉且無人察覺
    if (d.syncsVehicleField && !d.writesLogbook) {
      throw new Error(
        `變更類型註冊表：${at} 設了 syncsVehicleField 卻未設 writesLogbook。` +
        `寫回 Base 車輛表的變更必須同時生成 Logbook 行，否則 Excel 永遠追不上。`,
      );
    }

    // 要寫回車輛表，就必須知道寫哪一列
    if (d.syncsVehicleField && !d.vehicleField) {
      throw new Error(`變更類型註冊表：${at} 設了 syncsVehicleField 卻沒有 vehicleField`);
    }

    // 要進 Logbook，Type 列就不能為空，否則宏無法識別
    if (d.writesLogbook && !d.excelLogbookType.trim()) {
      throw new Error(`變更類型註冊表：${at} 設了 writesLogbook 卻沒有 excelLogbookType`);
    }

    // handler 表示「寫飛書自有表」的第三類動作，與 Logbook 路徑互斥
    if (d.handler && d.writesLogbook) {
      throw new Error(
        `變更類型註冊表：${at} 同時設了 handler 與 writesLogbook。` +
        `第三類動作（寫飛書自有表）不進 Logbook。`,
      );
    }

    // 未實現的處理器不得對用戶開放，否則會產生批不掉的僵屍申請
    if (d.handler && d.enabled) {
      throw new Error(
        `變更類型註冊表：${at} 的處理器 ${d.handler} 尚未實現，不得設 enabled: true`,
      );
    }
  }
}

assertRegistryInvariants(CHANGE_TYPES);

// ============================================================
// 查詢輔助
// ============================================================

const BY_ID = new Map(CHANGE_TYPES.map((d) => [d.id, d]));

export function getChangeType(id: string): ChangeTypeDef | undefined {
  return BY_ID.get(id);
}

/** 取定義，未登記則拋錯。批准等關鍵路徑用它，避免未知類型被靜默當作普通類型處理 */
export function requireChangeType(id: string): ChangeTypeDef {
  const def = BY_ID.get(id);
  if (!def) {
    throw new Error(
      `未登記的變更類型「${id}」。若為 1.0 遺留數據，請在 shared/change-types.ts 中補登記。`,
    );
  }
  return def;
}

/** 用戶當前可提交的類型；前端下拉與後端校驗共用同一個判斷 */
export function isSubmittableChangeType(id: string): boolean {
  return BY_ID.get(id)?.enabled === true;
}

export function listEnabledChangeTypes(): ChangeTypeDef[] {
  return CHANGE_TYPES.filter((d) => d.enabled);
}

/** 全量類型（含已下線），供檔案篩選等需要覆蓋存量數據的場景使用 */
export function listAllChangeTypes(): ChangeTypeDef[] {
  return [...CHANGE_TYPES];
}

/** Base 車輛表真實字段名；不對應車輛字段時為 null。取代原 getFieldName() */
export function getVehicleFieldName(id: string): string | null {
  return BY_ID.get(id)?.vehicleField ?? null;
}

/** 是否直接手動輸入（不查選項）。取代原 MANUAL_ONLY_TYPES */
export function isManualInputType(id: string): boolean {
  return BY_ID.get(id)?.optionSource === 'manual';
}
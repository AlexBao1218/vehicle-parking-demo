import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { History, RotateCcw } from 'lucide-react';
import * as approvalApi from '@/api/approval';
import type { ApprovalRecord, ArchiveQuery } from '@shared/api.interface';
import {
  listAllChangeTypes,
  type ChangeTypeDef,
} from '@shared/change-types';
import {
  STATUS_DRAFT,
  STATUS_PENDING,
  STATUS_APPROVED,
  STATUS_REJECTED,
} from '@/data/status';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ArchiveTable from './ArchiveTable';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;
const ALL = '__all__';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 檔案篩選必須覆蓋已下線的歷史類型，否則存量記錄永遠篩不出來
const ALL_TYPES: ChangeTypeDef[] = listAllChangeTypes();

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

interface ArchiveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ArchiveDrawer({
  open,
  onOpenChange,
}: ArchiveDrawerProps) {
  // 筛选 state
  const [licenseInput, setLicenseInput] = useState<string>('');
  const [vehicleLicense, setVehicleLicense] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // 结果 state
  const [items, setItems] = useState<ApprovalRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 车牌输入 300ms 防抖
  useEffect(() => {
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      setVehicleLicense(licenseInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [licenseInput]);

  // 查询（抽屉打开时才发请求；筛选变更一律回到第 1 页）
  const fetchData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const query: ArchiveQuery = {
        page: String(page),
        pageSize: String(PAGE_SIZE),
      };
      if (vehicleLicense) query.vehicleLicense = vehicleLicense;
      // status / changeType 传存储值（中文原值 / 类型 id），不传显示值
      if (typeFilter !== ALL) query.changeType = typeFilter;
      if (statusFilter !== ALL) query.status = statusFilter;
      if (DATE_RE.test(dateFrom)) query.dateFrom = dateFrom;
      if (DATE_RE.test(dateTo)) query.dateTo = dateTo;

      const data = await approvalApi.fetchArchive(query);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load archive.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [open, page, vehicleLicense, typeFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ------------------------------------------------------------------
  // 事件处理
  // ------------------------------------------------------------------

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleDateFromChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDateFrom(e.target.value);
    setPage(1);
  };

  const handleDateToChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDateTo(e.target.value);
    setPage(1);
  };

  const handleReset = () => {
    setLicenseInput('');
    setVehicleLicense('');
    setTypeFilter(ALL);
    setStatusFilter(ALL);
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[95vw] sm:w-[900px] sm:max-w-[900px]"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-[16px] font-semibold">
            <History className="size-4" />
            Request Archive
          </SheetTitle>
        </SheetHeader>

        {/* 筛选行 */}
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={licenseInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setLicenseInput(e.target.value)
            }
            placeholder="Search plate…"
            className="w-40"
          />
          <Select value={typeFilter} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {ALL_TYPES.map((t: ChangeTypeDef) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.enabled ? t.label : `${t.label} (retired)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value={STATUS_DRAFT}>Draft</SelectItem>
              <SelectItem value={STATUS_PENDING}>Pending</SelectItem>
              <SelectItem value={STATUS_APPROVED}>Approved</SelectItem>
              <SelectItem value={STATUS_REJECTED}>Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="text"
            value={dateFrom}
            onChange={handleDateFromChange}
            placeholder="From (YYYY-MM-DD)"
            className="w-44"
          />
          <Input
            type="text"
            value={dateTo}
            onChange={handleDateToChange}
            placeholder="To (YYYY-MM-DD)"
            className="w-44"
          />
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw className="mr-2 size-4" />
            Reset
          </Button>
        </div>

        {/* 表格区 */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <div className="flex items-center justify-center rounded-lg border border-border py-16">
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : (
            <ArchiveTable items={items} loading={loading} />
          )}
        </div>

        {/* 底部分页 */}
        <div className="flex items-center border-t pt-3">
          <p className="w-24 shrink-0 text-sm text-muted-foreground">
            {total} records
          </p>
          <div className="flex flex-1 items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
          <span className="w-24 shrink-0" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

import React, { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type { FollowUpItem } from '@shared/api.interface';
import { getChangeType } from '@shared/change-types';
import { formatDateDay } from '@/utils/date-format';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCheck } from 'lucide-react';

// ---------------------------------------------------------------------------
// After Approval 下欄：已批准但需線下處理的申請（writesLogbook === false：
// 三類補領 + 其他）。不進 Logbook、不影響車輛檔；勾選標記完成後從列表移除。
// ---------------------------------------------------------------------------

interface FollowUpPanelProps {
  items: FollowUpItem[];
  loading: boolean;
  onMarkComplete: (ids: string[]) => Promise<void>;
}

const FollowUpPanel: React.FC<FollowUpPanelProps> = ({ items, loading, onMarkComplete }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);

  const allSelected = useMemo(
    () => items.length > 0 && selectedIds.size === items.length,
    [items.length, selectedIds.size],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) setSelectedIds(new Set(items.map((i: FollowUpItem) => i.id)));
      else setSelectedIds(new Set());
    },
    [items],
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleMarkComplete = useCallback(async () => {
    const ids: string[] = items
      .filter((i: FollowUpItem) => selectedIds.has(i.id))
      .map((i: FollowUpItem) => i.id);
    if (ids.length === 0) return;
    setCompleting(true);
    try {
      await onMarkComplete(ids);
      setSelectedIds(new Set());
      toast.success(`${ids.length} item(s) marked as complete.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark complete.';
      toast.error(msg);
    } finally {
      setCompleting(false);
    }
  }, [items, selectedIds, onMarkComplete]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex h-[41px] shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <span className="shrink-0 whitespace-nowrap text-[14px] font-medium text-foreground">
          Follow-up ({items.length})
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-[12.5px]"
            disabled={items.length === 0}
            onClick={() => handleSelectAll(!allSelected)}
          >
            {allSelected ? 'Clear All' : 'Select All'}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="text-[12.5px]"
            disabled={selectedIds.size === 0 || completing}
            onClick={handleMarkComplete}
          >
            <CheckCheck className="size-3.5" />
            Mark Complete
          </Button>
          <span className="shrink-0 whitespace-nowrap font-mono text-[11.5px] text-muted-foreground">
            {selectedIds.size} selected
          </span>
        </div>
      </div>
      <p className="border-b border-border px-4 py-2 text-[11.5px] leading-snug text-muted-foreground">
        Approved requests that require offline action and do not affect the
        fleet record.
      </p>

      {loading ? (
        <div className="py-4 text-center text-[12.5px] text-muted-foreground">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="py-4 text-center text-[12.5px] text-muted-foreground">
          No follow-up items.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item: FollowUpItem) => {
            const typeLabel =
              getChangeType(item.changeType)?.label ?? item.changeType;
            return (
              <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                <Checkbox
                  className="mt-0.5 shrink-0"
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={(checked) =>
                    handleSelectOne(item.id, checked === true)
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[12.5px] font-medium text-foreground">
                      {item.vehicleLicense}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">
                      {item.approvalTime
                        ? formatDateDay(item.approvalTime)
                        : '—'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="shrink-0 rounded bg-accent px-1.5 py-px text-[11px] text-muted-foreground">
                      {typeLabel}
                    </span>
                    <span className="truncate text-[12px] text-foreground">
                      {item.remark || '—'}
                    </span>
                  </div>
                  {item.applicantName && (
                    <div className="mt-1 text-[11.5px] text-muted-foreground">
                      {item.applicantName}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default FollowUpPanel;

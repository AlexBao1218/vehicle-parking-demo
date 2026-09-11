import React, { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, CheckCheck, AlertTriangle } from 'lucide-react';
import type { PendingLogbookRow } from '@shared/api.interface';
import { getChangeType } from '@shared/change-types';
import { formatDateDay } from '@/utils/date-format';
import { useAdmin } from '@/contexts/AdminContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FleetRecordUpdatesPanelProps {
  rows: PendingLogbookRow[];
  loading?: boolean;
  onMarkSynced: (ids: string[]) => Promise<void>;
}

function buildTsv(rows: PendingLogbookRow[]): string {
  return rows
    .map((r) => {
      const type =
        getChangeType(r.changeType)?.excelLogbookType ?? r.changeType;
      return [r.logDate, r.vicLicense, type, r.logFrom, r.logTo, r.remark].join(
        '\t',
      );
    })
    .join('\n');
}

const FleetRecordUpdatesPanel: React.FC<FleetRecordUpdatesPanelProps> = ({
  rows,
  loading = false,
  onMarkSynced,
}) => {
  const { syncMode } = useAdmin();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fallbackTsv, setFallbackTsv] = useState<string | null>(null);

  const allSelected = useMemo(
    () => rows.length > 0 && selectedIds.size === rows.length,
    [rows.length, selectedIds.size],
  );

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) setSelectedIds(new Set(rows.map((r) => r.id)));
      else setSelectedIds(new Set());
    },
    [rows],
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleCopy = useCallback(async () => {
    if (selectedRows.length === 0) {
      toast.error('Select rows to copy first.');
      return;
    }
    setCopying(true);
    const tsv = buildTsv(selectedRows);
    try {
      await navigator.clipboard.writeText(tsv);
      toast.success('TSV copied to clipboard.');
    } catch {
      setFallbackTsv(tsv);
    } finally {
      setCopying(false);
    }
  }, [selectedRows]);

  const handleMarkSynced = useCallback(async () => {
    if (selectedRows.length === 0) return;
    const ids = selectedRows.map((r) => r.id);
    setSyncing(true);
    try {
      await onMarkSynced(ids);
      setSelectedIds(new Set());
      toast.success(`${ids.length} row(s) marked as complete.`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to mark complete.';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  }, [selectedRows, onMarkSynced]);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {/* Header */}
        <div className="flex h-[41px] shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <span className="shrink-0 whitespace-nowrap text-[14px] font-medium text-foreground">
            Fleet Record Updates ({rows.length})
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-[12.5px]"
              disabled={rows.length === 0}
              onClick={() => handleSelectAll(!allSelected)}
            >
              {allSelected ? 'Clear All' : 'Select All'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="text-[12.5px]"
              disabled={selectedRows.length === 0 || copying}
              onClick={handleCopy}
            >
              <Copy className="size-3.5" />
              Copy to Excel
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-[12.5px]"
              disabled={selectedRows.length === 0 || syncing}
              onClick={handleMarkSynced}
            >
              <CheckCheck className="size-3.5" />
              Mark Complete
            </Button>
            <span className="shrink-0 whitespace-nowrap font-mono text-[11.5px] text-muted-foreground">
              {selectedIds.size} selected
            </span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-4 text-center text-[12.5px] text-muted-foreground">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-4 text-center text-[12.5px] text-muted-foreground">
            No pending logbook entries.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Date</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Log-From</TableHead>
                  <TableHead>Log-To</TableHead>
                  <TableHead>Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const typeLabel =
                    getChangeType(row.changeType)?.label ?? row.changeType;
                  return (
                    <TableRow
                      key={row.id}
                      className={
                        row.isTestVehicle && syncMode === 'test'
                          ? 'bg-amber-50'
                          : undefined
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(row.id, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[12px]">
                        {formatDateDay(row.logDate)}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap text-[12.5px]">
                        {row.vicLicense}
                        {row.isTestVehicle && syncMode === 'test' && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600">
                            <AlertTriangle className="size-3" />
                            <span className="text-[10px]">
                              Test data — do not copy
                            </span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[12px]">
                        {typeLabel}
                      </TableCell>
                      <TableCell className="max-w-[180px] text-[12px]">
                        {row.logFrom ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate line-through text-muted-foreground">
                                {row.logFrom}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{row.logFrom}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[180px] text-[12px]">
                        {row.logTo ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate text-foreground">
                                {row.logTo}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{row.logTo}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-[12px] text-muted-foreground">
                        {row.remark}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Clipboard fallback dialog */}
      <Dialog
        open={!!fallbackTsv}
        onOpenChange={(open: boolean) => {
          if (!open) setFallbackTsv(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Copy failed — copy manually</DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] text-muted-foreground">
            Automatic clipboard copy failed. Press Ctrl+C (Mac: Cmd+C) to copy
            the text below and paste into Excel.
          </p>
          <textarea
            readOnly
            className="mt-2 w-full rounded-md border border-border bg-accent p-3 text-[11.5px] font-mono"
            rows={Math.min(selectedRows.length + 1, 12)}
            value={fallbackTsv ?? ''}
            onFocus={(e: React.FocusEvent<HTMLTextAreaElement>) =>
              e.target.select()
            }
            onClick={(e: React.MouseEvent<HTMLTextAreaElement>) =>
              (e.target as HTMLTextAreaElement).select()
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FleetRecordUpdatesPanel;

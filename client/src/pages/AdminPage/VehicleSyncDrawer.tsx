import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import * as approvalApi from '@/api/approval';
import type {
  PendingVehicleSyncRow,
  ExecuteVehicleSyncResult,
} from '@shared/api.interface';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Play } from 'lucide-react';
import { getChangeType } from '@shared/change-types';

interface VehicleSyncDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSyncComplete?: () => void;
}

const VehicleSyncDrawer: React.FC<VehicleSyncDrawerProps> = ({
  open,
  onOpenChange,
  onSyncComplete,
}) => {
  const [rows, setRows] = useState<PendingVehicleSyncRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await approvalApi.listPendingVehicleSync();
      setRows(res.data ?? []);
      setSelectedIds(new Set());
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load pending sync list.';
      toast.error(msg);
      logger.error('listPendingVehicleSync failed:', String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchRows();
  }, [open, fetchRows]);

  const allSelected = useMemo(
    () => rows.length > 0 && selectedIds.size === rows.length,
    [rows.length, selectedIds.size],
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

  const handleExecute = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Select rows to sync first.');
      return;
    }
    setSyncing(true);
    try {
      const res = await approvalApi.executeVehicleSync({
        ids: Array.from(selectedIds),
      });
      const result: ExecuteVehicleSyncResult = res.data;
      await fetchRows();
      toast.success(
        `Sync complete: ${result.successCount} succeeded, ${result.failCount} failed.`,
      );
      if (result.failCount > 0) {
        const failures = result.results.filter((r) => !r.success);
        const preview = failures
          .slice(0, 3)
          .map((r) => r.error || `Row ${r.id} failed`)
          .join('; ');
        toast.error(`Failed: ${preview}`);
      }
      onSyncComplete?.();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Sync failed.';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  }, [selectedIds, fetchRows, onSyncComplete]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[90vw] sm:w-[540px] p-0">
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle className="text-[14.5px] font-semibold">
            Vehicle Sync to Base
          </SheetTitle>
        </SheetHeader>

        <div className="flex h-[calc(100%-60px)] flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-[12px] text-muted-foreground">
              {rows.length} pending change(s)
            </span>
            <Button
              size="sm"
              className="text-[12.5px]"
              disabled={selectedIds.size === 0 || syncing || loading}
              onClick={handleExecute}
            >
              <Play className="size-3.5" />
              Execute Sync
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="py-10 text-center text-[12.5px] text-muted-foreground">
                Loading…
              </div>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center text-[12.5px] text-muted-foreground">
                No pending vehicle sync changes.
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          handleSelectAll(checked === true)
                        }
                      />
                    </TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>New</TableHead>
                    <TableHead>Effective</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const alreadyMatch = row.currentBaseValue === row.logTo;
                    const typeLabel =
                      getChangeType(row.changeType)?.label ?? row.changeType;
                    return (
                      <TableRow
                        key={row.id}
                        className={
                          alreadyMatch ? 'text-muted-foreground' : undefined
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
                        <TableCell className="font-medium whitespace-nowrap text-[12.5px]">
                          {row.vehicleLicense}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[12px]">
                          {typeLabel}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-[12px]">
                          {row.currentBaseValue}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-[12px]">
                          {row.logTo}
                          {alreadyMatch && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              already matches
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[12px]">
                          {row.effectiveDate}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VehicleSyncDrawer;

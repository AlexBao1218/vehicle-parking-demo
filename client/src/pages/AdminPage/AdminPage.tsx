import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';
import * as approvalApi from '@/api/approval';
import { STATUS_PENDING } from '@/data/status';
import { useAdmin } from '@/contexts/AdminContext';
import type {
  ApprovalRecord,
  PendingLogbookRow,
  SyncStatusResponse,
  FollowUpItem,
} from '@shared/api.interface';
import SyncStatusBar from './SyncStatusBar';
import ApprovalListPanel from './ApprovalListPanel';
import ApprovalDetailPanel from './ApprovalDetailPanel';
import FleetRecordUpdatesPanel from './FleetRecordUpdatesPanel';
import FollowUpPanel from './FollowUpPanel';
import VehicleSyncDrawer from './VehicleSyncDrawer';
import ArchiveDrawer from './ArchiveDrawer';
import ApprovalActionDialog from './ApprovalActionDialog';
import EditRequestDialog from './EditRequestDialog';
import { AdminPageSkeleton } from './AdminPageSkeleton';
import { AdminPageNotAllowed } from './AdminPageEmpty';

type TabValue = 'approvals' | 'after-approval';

export default function AdminPage() {
  const { isAdmin, loading: adminLoading, viewAsUser } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab: TabValue =
    searchParams.get('tab') === 'after-approval'
      ? 'after-approval'
      : 'approvals';

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  // --- Data state ---
  const [requests, setRequests] = useState<ApprovalRecord[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [logbookRows, setLogbookRows] = useState<PendingLogbookRow[]>([]);
  const [logbookLoading, setLogbookLoading] = useState(false);

  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);

  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [approveTarget, setApproveTarget] =
    useState<ApprovalRecord | null>(null);
  const [rejectTarget, setRejectTarget] =
    useState<ApprovalRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [editTarget, setEditTarget] = useState<ApprovalRecord | null>(null);

  // --- Data fetching ---
  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await approvalApi.listRequests(STATUS_PENDING);
      const items = res.data?.items ?? [];
      setRequests(items);
      setSelectedId((prev) => {
        if (prev && items.some((r) => r.id === prev)) return prev;
        return items[0]?.id ?? null;
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load requests.';
      toast.error(msg);
      setRequests([]);
      setSelectedId(null);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const fetchLogbook = useCallback(async () => {
    setLogbookLoading(true);
    try {
      const res = await approvalApi.listPendingLogbook();
      setLogbookRows(res.data ?? []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load logbook rows.';
      toast.error(msg);
      setLogbookRows([]);
    } finally {
      setLogbookLoading(false);
    }
  }, []);

  const fetchFollowUps = useCallback(async () => {
    setFollowUpsLoading(true);
    try {
      const res = await approvalApi.listFollowUps();
      setFollowUps(res.data ?? []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load follow-ups.';
      toast.error(msg);
      setFollowUps([]);
    } finally {
      setFollowUpsLoading(false);
    }
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    setSyncStatusLoading(true);
    try {
      const res = await approvalApi.getSyncStatus();
      setSyncStatus(res.data);
    } catch (err: unknown) {
      logger.error('getSyncStatus failed:', String(err));
      setSyncStatus(null);
    } finally {
      setSyncStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminLoading || !isAdmin || viewAsUser) return;
    fetchRequests();
    fetchLogbook();
    fetchFollowUps();
    fetchSyncStatus();
  }, [adminLoading, isAdmin, viewAsUser, fetchRequests, fetchLogbook, fetchFollowUps, fetchSyncStatus]);

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedId) ?? null,
    [requests, selectedId],
  );

  // --- Actions ---
  const handleApprove = useCallback(
    async (comment: string) => {
      if (!approveTarget) return;
      setActionLoading(true);
      try {
        await approvalApi.approveRequest(approveTarget.id, {
          approvalComment: comment || undefined,
        });
        // Remove from list, auto-select next
        const remaining = requests.filter((r) => r.id !== approveTarget.id);
        setRequests(remaining);
        if (selectedId === approveTarget.id) {
          setSelectedId(remaining[0]?.id ?? null);
        }
        toast.success('Approved.');
        // Approval may generate new pending sync entries / follow-up items
        fetchSyncStatus();
        fetchFollowUps();
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Operation failed.';
        toast.error(msg);
      } finally {
        setActionLoading(false);
        setApproveTarget(null);
      }
    },
    [approveTarget, requests, selectedId, fetchSyncStatus, fetchFollowUps],
  );

  const handleReject = useCallback(
    async (comment: string) => {
      if (!rejectTarget) return;
      setActionLoading(true);
      try {
        await approvalApi.rejectRequest(rejectTarget.id, {
          approvalComment: comment,
        });
        const remaining = requests.filter((r) => r.id !== rejectTarget.id);
        setRequests(remaining);
        if (selectedId === rejectTarget.id) {
          setSelectedId(remaining[0]?.id ?? null);
        }
        toast.success('Rejected.');
        fetchSyncStatus();
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Operation failed.';
        toast.error(msg);
      } finally {
        setActionLoading(false);
        setRejectTarget(null);
      }
    },
    [rejectTarget, requests, selectedId, fetchSyncStatus],
  );

  const handleEditSaved = useCallback((updated: ApprovalRecord) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r)),
    );
    setSelectedId(updated.id);
  }, []);

  const handleMarkSynced = useCallback(
    async (ids: string[]) => {
      await approvalApi.markLogbookSynced({ ids });
      await fetchLogbook();
    },
    [fetchLogbook],
  );

  const handleMarkFollowUpsComplete = useCallback(
    async (ids: string[]) => {
      await approvalApi.markFollowUpsComplete({ ids });
      await fetchFollowUps();
    },
    [fetchFollowUps],
  );

  const handleSyncComplete = useCallback(() => {
    fetchSyncStatus();
    fetchLogbook();
  }, [fetchSyncStatus, fetchLogbook]);

  // --- Render ---
  if (adminLoading) return <AdminPageSkeleton />;
  if (!isAdmin || viewAsUser) return <AdminPageNotAllowed />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      {/* Sync status bar */}
      <div className="mb-4">
        <SyncStatusBar
          pendingCount={syncStatus?.pendingCount ?? 0}
          lastSyncedAt={syncStatus?.lastSyncedAt ?? null}
          loading={syncStatusLoading}
          onReview={() => setDrawerOpen(true)}
          onRefresh={fetchSyncStatus}
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <div className="mb-4 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="approvals" className="group gap-1.5">
              Approvals
              <span className="rounded-full bg-background px-1.5 py-px text-[11px] leading-none text-muted-foreground group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground">
                {requests.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="after-approval" className="group gap-1.5">
              After Approval
              <span className="rounded-full bg-background px-1.5 py-px text-[11px] leading-none text-muted-foreground group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground">
                {logbookRows.length}
              </span>
            </TabsTrigger>
          </TabsList>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Request Archive"
                onClick={() => setArchiveOpen(true)}
              >
                <History className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Request Archive</TooltipContent>
          </Tooltip>
        </div>

        <TabsContent value="approvals">
            {/* 桌面端外层定高：动作条 y 由容器唯一决定，两列天然等高 */}
            <div className="min-h-[400px] md:h-[560px] overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid h-full grid-cols-1 md:grid-cols-[244px_1fr]">
              <div className="border-b md:border-b-0 md:border-r border-border">
                <ApprovalListPanel
                  requests={requests}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  loading={requestsLoading}
                />
              </div>
              <ApprovalDetailPanel
                request={selectedRequest}
                onApprove={setApproveTarget}
                onReject={setRejectTarget}
                onEdit={setEditTarget}
                loading={requestsLoading}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="after-approval">
          <div className="flex flex-col gap-4">
            <FleetRecordUpdatesPanel
              rows={logbookRows}
              loading={logbookLoading}
              onMarkSynced={handleMarkSynced}
            />
            <FollowUpPanel
              items={followUps}
              loading={followUpsLoading}
              onMarkComplete={handleMarkFollowUpsComplete}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Drawer */}
      <ArchiveDrawer open={archiveOpen} onOpenChange={setArchiveOpen} />
      <VehicleSyncDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSyncComplete={handleSyncComplete}
      />

      {/* Dialogs */}
      <ApprovalActionDialog
        open={!!approveTarget}
        onOpenChange={(open: boolean) => {
          if (!open) setApproveTarget(null);
        }}
        mode="approve"
        vehicleLicense={approveTarget?.vehicleLicense}
        onConfirm={handleApprove}
        loading={actionLoading}
      />
      <ApprovalActionDialog
        open={!!rejectTarget}
        onOpenChange={(open: boolean) => {
          if (!open) setRejectTarget(null);
        }}
        mode="reject"
        vehicleLicense={rejectTarget?.vehicleLicense}
        onConfirm={handleReject}
        loading={actionLoading}
      />
      <EditRequestDialog
        open={!!editTarget}
        onOpenChange={(open: boolean) => {
          if (!open) setEditTarget(null);
        }}
        record={editTarget}
        onSaved={handleEditSaved}
      />
    </div>
  );
}

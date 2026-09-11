import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as approvalApi from '@/api/approval';
import { STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED } from '@/data/status';
import { getStatusLabel } from '@/data/labels';
import { getChangeType } from '@shared/change-types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { ApprovalRecord, EditHistoryEntry } from '@shared/api.interface';
import { formatEditChange } from '@/utils/edit-history';
import { formatDateDay, formatDateTime } from '@/utils/date-format';
import { RefreshCwIcon, ClipboardListIcon } from 'lucide-react';

// ===== 狀態徽章配置 =====
const STATUS_CONFIG: Record<string, { className: string }> = {
  [STATUS_PENDING]: {
    className: 'bg-warning text-warning-foreground border-transparent',
  },
  [STATUS_APPROVED]: {
    className: 'bg-success text-success-foreground border-transparent',
  },
  [STATUS_REJECTED]: {
    className: 'bg-destructive text-destructive-foreground border-transparent',
  },
};

// ===== Framer Motion Variants =====
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
};

// ===== 子組件 =====

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status];
  if (!config) {
    return <Badge variant="secondary">{getStatusLabel(status)}</Badge>;
  }
  return <Badge className={config.className}>{getStatusLabel(status)}</Badge>;
}

function RecordCard({ record }: { record: ApprovalRecord }) {
  const editHistory: EditHistoryEntry[] = record.editHistory ?? [];

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {/* 左側：車輛資訊 */}
            <div className="min-w-0 flex-1 space-y-2.5">
              {/* 車牌 + 狀態徽章 */}
              <div className="flex items-center gap-3">
                <span className="truncate text-lg font-bold text-foreground">
                  {record.vehicleLicense}
                </span>
                <StatusBadge status={record.status} />
                {editHistory.length > 0 && (
                  <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                    Edited
                  </Badge>
                )}
              </div>

              {/* 變更類型 */}
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Change Type: </span>
                {getChangeType(record.changeType)?.label ?? record.changeType}
              </div>

              {/* Log-From → Log-To */}
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Log-From: </span>
                {record.logFrom || '—'}
                <span className="mx-2 text-muted-foreground">→</span>
                <span className="font-medium text-foreground">Log-To: </span>
                {record.logTo || '—'}
              </div>

              {/* 生效日期 */}
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Effective Date: </span>
                {formatDateDay(record.effectiveDate)}
              </div>

              {/* 備註 */}
              {record.remark && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Remark: </span>
                  {record.remark}
                </div>
              )}
            </div>

            {/* 右側：審批資訊 */}
            <div className="space-y-2.5 sm:w-56 sm:text-right">
              <div className="text-sm">
                <span className="text-muted-foreground">Comment: </span>
                <span className="text-foreground">
                  {record.approvalComment || '—'}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Approval Time: </span>
                <span className="text-foreground">
                  {formatDateTime(record.approvalTime)}
                </span>
              </div>
            </div>
          </div>

          {/* 管理員修改記錄 */}
          {editHistory.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Edit History
              </p>
              {editHistory.map((entry, ei) => (
                <div key={ei} className="text-xs text-muted-foreground">
                  {entry.changes.map((ch, ci) => (
                    <p key={ci}>
                      {formatDateTime(entry.editedAt)} {formatEditChange(ch)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i: number) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-7 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="space-y-3 sm:w-56">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-28 sm:ml-auto" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ===== 頁面主組件 =====

export default function ApprovalHistoryPage() {
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await approvalApi.listMyRequests();
      if (res.success) {
        setRecords(res.data);
      } else {
        setError(res.message || 'Failed to load. Please try again later.');
      }
    } catch (err: unknown) {
      logger.error('Failed to load approval records:', String(err));
      setError('Failed to load data. Please try again later or contact the system administrator.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      {/* 標題區 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h2 className="text-2xl font-bold text-foreground">My Requests</h2>
      </motion.div>

      {/* 內容區 */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="mb-4 rounded-full bg-muted p-4">
            <RefreshCwIcon className="size-8 text-muted-foreground" />
          </div>
          <p className="mb-4 text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={fetchRecords}>
            <RefreshCwIcon className="mr-2 size-4" />
            Retry
          </Button>
        </motion.div>
      ) : records.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="mb-4 rounded-full bg-muted p-4">
            <ClipboardListIcon className="size-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No requests yet.</p>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {records.map((record: ApprovalRecord) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
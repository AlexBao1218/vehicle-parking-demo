import { RefreshCw, AlertTriangle } from 'lucide-react';
import { formatDateTime } from '@/utils/date-format';

interface SyncStatusBarProps {
  pendingCount: number;
  lastSyncedAt: string | null;
  onReview: () => void;
  onRefresh: () => void;
  loading?: boolean;
}

export default function SyncStatusBar({
  pendingCount,
  lastSyncedAt,
  onReview,
  onRefresh,
  loading = false,
}: SyncStatusBarProps) {
  if (loading) {
    return (
      <div className="flex h-9 items-center justify-between rounded-md border border-border bg-accent/50 px-3">
        <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          Checking sync status...
        </span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex h-9 items-center justify-between rounded-md border border-border bg-amber-50 px-3">
        <span className="flex items-center gap-2 text-[12.5px] text-amber-800">
          <AlertTriangle className="size-3.5" />
          {pendingCount} vehicles updated but not yet synced to Fleet List
        </span>
        <button
          type="button"
          onClick={onReview}
          className="font-mono text-[10.5px] text-amber-700 hover:text-amber-900 transition-colors"
        >
          Review
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center justify-between rounded-md border border-border bg-accent/50 px-3">
      <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <span
          className={`size-1.5 rounded-full ${
            lastSyncedAt ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          }`}
        />
        {lastSyncedAt
          ? `All changes synced · Last sync: ${formatDateTime(lastSyncedAt)}`
          : 'No changes synced yet'}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        className="flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <RefreshCw className="size-3" />
        Refresh
      </button>
    </div>
  );
}

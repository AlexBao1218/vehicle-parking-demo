import React from 'react';
import type { ApprovalRecord } from '@shared/api.interface';
import { getChangeType } from '@shared/change-types';

interface ApprovalListPanelProps {
  requests: ApprovalRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

const ApprovalListPanel: React.FC<ApprovalListPanelProps> = ({
  requests,
  selectedId,
  onSelect,
  loading = false,
}) => {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-[41px] shrink-0 items-center gap-1.5 border-b border-border px-3">
        <span className="text-[12px] font-medium text-muted-foreground">
          Pending
        </span>
        <span className="font-mono text-[11.5px] text-muted-foreground">
          {requests.length}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">
            Loading…
          </div>
        ) : requests.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">
            No pending requests.
          </div>
        ) : (
          <ul className="py-1">
            {requests.map((r) => {
              const selected = r.id === selectedId;
              const changeLabel =
                getChangeType(r.changeType)?.label ?? r.changeType;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className={[
                      'flex w-full flex-col gap-0.5 border-l-2 px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-l-primary bg-accent/50'
                        : 'border-l-transparent hover:bg-accent/40',
                    ].join(' ')}
                  >
                    <span className="text-[13px] font-medium text-foreground">
                      {r.vehicleLicense}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {changeLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ApprovalListPanel;

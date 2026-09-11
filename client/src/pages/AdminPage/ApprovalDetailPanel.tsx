import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Image } from '@/components/ui/image';
import {
  Pencil,
  CheckCircle,
  XCircle,
  Calendar,
  FileText,
  Paperclip,
  X,
} from 'lucide-react';
import type { ApprovalRecord } from '@shared/api.interface';
import { getStatusLabel } from '@/data/labels';
import { getChangeType } from '@shared/change-types';
import { formatEditChange } from '@/utils/edit-history';
import { STATUS_PENDING } from '@/data/status';
import { formatDateDay, formatDateTime } from '@/utils/date-format';

interface ApprovalDetailPanelProps {
  request: ApprovalRecord | null;
  onApprove: (r: ApprovalRecord) => void;
  onReject: (r: ApprovalRecord) => void;
  onEdit: (r: ApprovalRecord) => void;
  loading?: boolean;
}

const STATUS_BADGE: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  [STATUS_PENDING]: { variant: 'secondary' },
  已批准: { variant: 'default' },
  已拒絕: { variant: 'destructive' },
};

const ApprovalDetailPanel: React.FC<ApprovalDetailPanelProps> = ({
  request,
  onApprove,
  onReject,
  onEdit,
  loading = false,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="h-[41px] shrink-0 border-b border-border" />
        <div className="flex flex-1 items-center justify-center text-[12.5px] text-muted-foreground">
          Loading request…
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="h-[41px] shrink-0 border-b border-border" />
        <div className="flex flex-1 items-center justify-center text-[12.5px] text-muted-foreground">
          Select a request to view details.
        </div>
      </div>
    );
  }

  const isPending = request.status === STATUS_PENDING;
  const badge = STATUS_BADGE[request.status] ?? { variant: 'outline' as const };
  const changeLabel =
    getChangeType(request.changeType)?.label ?? request.changeType;
  // writesLogbook === false（補領類、其他）：無 Log-From / Log-To，改顯示 Description。
  // 外層卡片固定 560px + 內容區獨立捲動，行數變化不會移動動作條位置，無需佔位。
  const writesLogbook = getChangeType(request.changeType)?.writesLogbook ?? true;
  const hasEdits = request.editHistory && request.editHistory.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex h-[41px] shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14.5px] font-semibold text-foreground truncate">
            {request.vehicleLicense}
          </span>
          <Badge variant={badge.variant} className="text-[11.5px]">
            {getStatusLabel(request.status)}
          </Badge>
          {hasEdits && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="cursor-help border-amber-400 text-amber-600 text-[11.5px]"
                >
                  Edited
                </Badge>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="max-w-xs space-y-1.5 p-3"
              >
                <p className="text-[11.5px] font-medium text-muted-foreground">
                  Admin edit history
                </p>
                {request.editHistory.map((entry, ei) => (
                  <div key={ei} className="text-[11.5px]">
                    <p className="text-muted-foreground">
                      {formatDateTime(entry.editedAt)}
                    </p>
                    {entry.changes.map((ch, ci) => (
                      <p key={ci} className="ml-2">
                        {formatEditChange(ch)}
                      </p>
                    ))}
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6 text-[13px]">
        {/* Meta */}
        <div className="space-y-3">
          <FieldRow label="Change Type" value={changeLabel} />
        </div>

        {/* Change details */}
        <div className="space-y-3">
          {writesLogbook && (
            <>
              <FieldRow
                label="Log-From"
                value={request.logFrom || 'None'}
                muted={!request.logFrom}
              />
              <FieldRow
                label="Log-To"
                value={request.logTo || 'None'}
                muted={!request.logTo}
              />
            </>
          )}
          <FieldRow
            label={writesLogbook ? 'Effective Date' : 'Expected Date'}
            value={
              request.effectiveDate
                ? formatDateDay(request.effectiveDate)
                : 'None'
            }
            muted={!request.effectiveDate}
            icon={
              request.effectiveDate ? (
                <Calendar className="size-3.5" />
              ) : undefined
            }
          />
          <FieldRow
            label="Requested by"
            value={request.applicantName ?? 'None'}
            muted={!request.applicantName}
          />
          <FieldRow
            label="Submitted"
            value={formatDateTime(request.applyTime)}
          />
          <FieldRow
            label={writesLogbook ? 'Remark' : 'Description'}
            value={request.remark || 'None'}
            muted={!request.remark}
            icon={request.remark ? <FileText className="size-3.5" /> : undefined}
          />
          <FieldRow
            label="Attachment"
            muted={request.attachments.length === 0}
            value={
              request.attachments.length === 0 ? (
                'None'
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {request.attachments.map((att, idx) => (
                    <button
                      key={idx}
                      type="button"
                      title={att.name}
                      onClick={() => setPreviewUrl(att.url)}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-[12px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                      <span className="max-w-[160px] truncate">{att.name}</span>
                    </button>
                  ))}
                </div>
              )
            }
          />
        </div>

        {/* Approval info */}
        {!isPending && request.approvalTime && (
          <div className="rounded-md border border-border bg-accent/40 p-4 space-y-1.5 text-[12px] text-muted-foreground">
            {request.approverName && (
              <div>
                <span className="font-medium">Approved by: </span>
                {request.approverName}
              </div>
            )}
            <div>
              <span className="font-medium">At: </span>
              {formatDateTime(request.approvalTime)}
            </div>
            {request.approvalComment && (
              <div>
                <span className="font-medium">Comment: </span>
                {request.approvalComment}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex h-[52px] shrink-0 items-center justify-end gap-2 border-t border-border bg-accent/50 px-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-[12.5px]"
            onClick={() => onEdit(request)}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[12.5px] bg-card text-muted-foreground hover:bg-card hover:text-destructive hover:border-destructive/40"
            onClick={() => onReject(request)}
          >
            <XCircle className="size-3.5" />
            Reject
          </Button>
          <Button
            variant="default"
            size="sm"
            className="text-[12.5px]"
            onClick={() => onApprove(request)}
          >
            <CheckCircle className="size-3.5" />
            Approve
          </Button>
        </div>
      )}

      {/* Image preview */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent
          className="max-w-[90vw] max-h-[90vh] p-1"
          showCloseButton={false}
        >
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            className="absolute top-3 right-3 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
          >
            <X className="size-4" />
          </button>
          {previewUrl && (
            <Image
              src={previewUrl}
              alt="Attachment preview"
              className="max-h-[85vh] w-full object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function FieldRow({
  label,
  value,
  icon,
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 min-w-0 leading-relaxed">
      <span className="w-[112px] shrink-0 text-[12px] text-muted-foreground">
        {label}
      </span>
      {icon && (
        <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>
      )}
      <span
        className={`break-words min-w-0 ${muted ? 'text-muted-foreground' : 'text-foreground'}`}
      >
        {value}
      </span>
    </div>
  );
}

export default ApprovalDetailPanel;

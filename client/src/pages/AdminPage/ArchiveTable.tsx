import { Fragment, useState } from 'react';
import type {
  ApprovalRecord,
  EditHistoryChange,
  EditHistoryEntry,
} from '@shared/api.interface';
import { getChangeType } from '@shared/change-types';
import {
  STATUS_DRAFT,
  STATUS_PENDING,
  STATUS_APPROVED,
  STATUS_REJECTED,
} from '@/data/status';
import { getStatusLabel } from '@/data/labels';
import { formatEditChange } from '@/utils/edit-history';
import { formatDateTime } from '@/utils/date-format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import ArchiveRecordDetail from './ArchiveRecordDetail';

const STATUS_DOT: Record<string, string> = {
  [STATUS_PENDING]: 'bg-amber-500',
  [STATUS_APPROVED]: 'bg-emerald-500',
  [STATUS_REJECTED]: 'bg-red-500',
  [STATUS_DRAFT]: 'bg-muted-foreground/40',
};

function ChangeCell({ record }: { record: ApprovalRecord }) {
  const writesLogbook = getChangeType(record.changeType)?.writesLogbook ?? true;

  if (!writesLogbook) {
    const remark: string = record.remark ?? '';
    if (!remark) return <span className="text-muted-foreground">-</span>;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block truncate text-foreground">{remark}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">{remark}</TooltipContent>
      </Tooltip>
    );
  }

  const from: string = record.logFrom || '-';
  const to: string = record.logTo || '-';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block truncate">
          <span className="line-through text-muted-foreground">{from}</span>
          <span className="mx-1.5 text-muted-foreground">→</span>
          <span className="text-foreground">{to}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <span className="line-through text-muted-foreground">{from}</span>
        <span className="mx-1.5 text-muted-foreground">→</span>
        <span className="text-foreground">{to}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function StatusCell({ record }: { record: ApprovalRecord }) {
  const dot: string = STATUS_DOT[record.status] ?? 'bg-muted-foreground/40';
  const history: EditHistoryEntry[] = record.editHistory ?? [];

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-2 shrink-0 rounded-full ${dot}`} />
      <span className="text-foreground">{getStatusLabel(record.status)}</span>
      {history.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="cursor-default text-[11.5px]">
              Edited
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <div className="space-y-1">
              {history.map((entry: EditHistoryEntry, ei: number) =>
                entry.changes.map((ch: EditHistoryChange, ci: number) => (
                  <p key={`${ei}-${ci}`}>{formatEditChange(ch)}</p>
                )),
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

interface ArchiveTableProps {
  items: ApprovalRecord[];
  loading: boolean;
}

export default function ArchiveTable({ items, loading }: ArchiveTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[130px]">Submitted</TableHead>
          <TableHead className="w-[90px]">Plate</TableHead>
          <TableHead className="w-[150px]">Type</TableHead>
          <TableHead>Change</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
          <TableHead className="w-[110px]">Approved by</TableHead>
          <TableHead className="w-[140px]">Approved at</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && items.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="py-16 text-center text-muted-foreground"
            >
              Loading…
            </TableCell>
          </TableRow>
        ) : items.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="py-16 text-center text-muted-foreground"
            >
              No records match the filters.
            </TableCell>
          </TableRow>
        ) : (
          items.map((record: ApprovalRecord) => (
            <Fragment key={record.id}>
              <TableRow
                className="cursor-pointer"
                onClick={() =>
                  setExpandedId((prev) =>
                    prev === record.id ? null : record.id,
                  )
                }
              >
                <TableCell className="align-top">
                  {formatDateTime(record.applyTime)}
                </TableCell>
                <TableCell className="align-top font-medium">
                  {record.vehicleLicense}
                </TableCell>
                <TableCell className="align-top">
                  {getChangeType(record.changeType)?.label ?? record.changeType}
                </TableCell>
                <TableCell className="align-top">
                  <ChangeCell record={record} />
                </TableCell>
                <TableCell className="align-top">
                  <StatusCell record={record} />
                </TableCell>
                <TableCell className="align-top">
                  {record.approverName ?? '-'}
                </TableCell>
                <TableCell className="align-top">
                  {record.approvalTime
                    ? formatDateTime(record.approvalTime)
                    : '-'}
                </TableCell>
              </TableRow>
              {expandedId === record.id && (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <ArchiveRecordDetail record={record} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))
        )}
      </TableBody>
    </Table>
  );
}

import type { ReactNode } from 'react';
import type {
  ApprovalRecord,
  AttachmentInfo,
  EditHistoryChange,
  EditHistoryEntry,
} from '@shared/api.interface';
import { getChangeType } from '@shared/change-types';
import { formatEditChange } from '@/utils/edit-history';
import { formatDateTime } from '@/utils/date-format';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

interface DetailFieldProps {
  label: string;
  full?: boolean;
  children: ReactNode;
}

function DetailField({ label, full, children }: DetailFieldProps) {
  return (
    <div className={cn('space-y-1', full && 'md:col-span-2')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

interface ArchiveRecordDetailProps {
  record: ApprovalRecord;
}

export default function ArchiveRecordDetail({
  record,
}: ArchiveRecordDetailProps) {
  const isOffline: boolean =
    getChangeType(record.changeType)?.writesLogbook === false;
  const history: EditHistoryEntry[] = record.editHistory ?? [];
  const attachments: AttachmentInfo[] = record.attachments ?? [];

  return (
    <div className="grid gap-4 bg-muted/40 p-4 md:grid-cols-2">
      <DetailField label={isOffline ? 'Description' : 'Remark'} full>
        {record.remark ? (
          <p className="whitespace-pre-wrap break-words">{record.remark}</p>
        ) : (
          '-'
        )}
      </DetailField>

      <DetailField label={isOffline ? 'Expected Date' : 'Effective Date'}>
        {record.effectiveDate ?? '-'}
      </DetailField>

      <DetailField label="Comment">
        {record.approvalComment ?? '-'}
      </DetailField>

      {attachments.length > 0 && (
        <DetailField label="Attachments" full>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att: AttachmentInfo, index: number) => (
              <Image
                key={`${att.url}-${index}`}
                src={att.url}
                alt={att.name}
                className="size-20 cursor-pointer rounded-md border object-cover"
                onClick={() => window.open(att.url, '_blank')}
              />
            ))}
          </div>
        </DetailField>
      )}

      {history.length > 0 && (
        <DetailField label="Edit History" full>
          <div className="space-y-2">
            {history.map((entry: EditHistoryEntry, ei: number) => (
              <div key={ei}>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(entry.editedAt)} · {entry.editedBy}
                </p>
                {entry.changes.map((ch: EditHistoryChange, ci: number) => (
                  <p key={ci} className="text-sm">
                    {formatEditChange(ch)}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </DetailField>
      )}
    </div>
  );
}

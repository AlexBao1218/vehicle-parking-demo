import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import * as approvalApi from '@/api/approval';
import { listEnabledChangeTypes } from '@shared/change-types';
import type { ApprovalRecord, EditRequest } from '@shared/api.interface';

interface EditRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ApprovalRecord | null;
  onSaved: (updated: ApprovalRecord) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export default function EditRequestDialog({
  open,
  onOpenChange,
  record,
  onSaved,
}: EditRequestDialogProps) {
  const [changeType, setChangeType] = useState<string>('');
  const [logFrom, setLogFrom] = useState<string>('');
  const [logTo, setLogTo] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  const [baseValue, setBaseValue] = useState<string>('');
  const [baseLoading, setBaseLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    if (record) {
      setChangeType(record.changeType);
      setLogFrom(record.logFrom);
      setLogTo(record.logTo);
      setEffectiveDate(formatDate(record.effectiveDate));
      setRemark(record.remark);
    }
  }, [record]);

  useEffect(() => {
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (open && record) {
      setBaseValue('');
      setBaseLoading(true);
      approvalApi
        .getVehicleDetail(record.vehicleId)
        .then((res) => {
          if (res.success && res.data) {
            const key =
              record.changeType.toLowerCase() as keyof typeof res.data;
            setBaseValue(
              (res.data[key] as string | undefined) ?? '',
            );
          }
        })
        .catch((err: unknown) => {
          logger.error('Failed to fetch vehicle detail for edit:', String(err));
        })
        .finally(() => {
          setBaseLoading(false);
        });
    }
  }, [open, record]);

  const handleSave = async () => {
    if (!record) return;
    setSaving(true);
    try {
      const body: EditRequest = {};
      if (changeType !== record.changeType) body.changeType = changeType;
      if (logFrom !== record.logFrom) body.logFrom = logFrom;
      if (logTo !== record.logTo) body.logTo = logTo;
      const newDate = effectiveDate || null;
      if (newDate !== formatDate(record.effectiveDate))
        body.effectiveDate = newDate;
      if (remark !== record.remark) body.remark = remark;

      const res = await approvalApi.editRequest(record.id, body);
      if (res.success) {
        toast.success('Changes saved.');
        onOpenChange(false);
        onSaved(res.data);
      } else {
        toast.error(res.message || 'Failed to save.');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const enabledTypes = listEnabledChangeTypes();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Request</DialogTitle>
          <DialogDescription>
            {record?.vehicleLicense}
            {record?.applicantName ? ` · ${record.applicantName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-muted-foreground">
              Change Type
            </Label>
            <Select value={changeType} onValueChange={setChangeType}>
              <SelectTrigger>
                <SelectValue placeholder="Select change type" />
              </SelectTrigger>
              <SelectContent>
                {enabledTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[12.5px] text-muted-foreground">
                Log-From
              </Label>
              {baseValue && (
                <span className="text-[11.5px] text-muted-foreground">
                  Current Base value: {baseValue}
                </span>
              )}
            </div>
            <Input value={logFrom} onChange={(e) => setLogFrom(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-muted-foreground">Log-To</Label>
            <Input value={logTo} onChange={(e) => setLogTo(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-muted-foreground">
              Effective Date
            </Label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-muted-foreground">Remark</Label>
            <Textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || baseLoading}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

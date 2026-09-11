import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle } from 'lucide-react';

type DialogMode = 'approve' | 'reject';

interface ApprovalActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DialogMode;
  vehicleLicense?: string;
  onConfirm: (comment: string) => void;
  loading?: boolean;
}

const MODE_CONFIG: Record<
  DialogMode,
  {
    title: string;
    icon: React.ReactNode;
    buttonVariant: 'default' | 'destructive';
    buttonLabel: string;
    commentRequired: boolean;
    placeholder: string;
  }
> = {
  approve: {
    title: 'Approve request?',
    icon: <CheckCircle className="size-4" />,
    buttonVariant: 'default',
    buttonLabel: 'Approve',
    commentRequired: false,
    placeholder: 'Approval comment (optional)…',
  },
  reject: {
    title: 'Reject request?',
    icon: <XCircle className="size-4" />,
    buttonVariant: 'destructive',
    buttonLabel: 'Reject',
    commentRequired: true,
    placeholder: 'Reason for rejection…',
  },
};

export default function ApprovalActionDialog({
  open,
  onOpenChange,
  mode,
  vehicleLicense,
  onConfirm,
  loading = false,
}: ApprovalActionDialogProps) {
  const [comment, setComment] = useState('');
  const config = MODE_CONFIG[mode];

  const canSubmit = config.commentRequired
    ? comment.trim().length > 0
    : true;

  const handleOpenChange = (next: boolean) => {
    if (!next) setComment('');
    onOpenChange(next);
  };

  const handleConfirm = () => {
    onConfirm(comment.trim());
    setComment('');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>
            Vehicle: {vehicleLicense ?? '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Approval comment
            {config.commentRequired && (
              <span className="text-destructive ml-0.5">*</span>
            )}
            {!config.commentRequired && (
              <span className="text-muted-foreground font-normal">
                {' '}
                (optional)
              </span>
            )}
          </label>
          <Textarea
            value={comment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setComment(e.target.value)
            }
            placeholder={config.placeholder}
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant={config.buttonVariant}
            disabled={!canSubmit || loading}
            onClick={handleConfirm}
          >
            {config.icon}
            {config.buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

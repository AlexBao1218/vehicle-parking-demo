import React from 'react';
import { ShieldAlert, Inbox } from 'lucide-react';

export function AdminPageNotAllowed() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <ShieldAlert className="size-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          No admin access
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You do not have permission to view the admin approval page.
        </p>
      </div>
    </div>
  );
}

interface AdminPageEmptyProps {
  activeTab: 'approvals' | 'after-approval';
}

const EMPTY_MESSAGES: Record<AdminPageEmptyProps['activeTab'], string> = {
  approvals: 'No pending approval requests.',
  'after-approval': 'Nothing awaiting export.',
};

export function AdminPageEmpty({ activeTab }: AdminPageEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent mb-3">
        <Inbox className="size-7 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">
        {EMPTY_MESSAGES[activeTab]}
      </p>
    </div>
  );
}

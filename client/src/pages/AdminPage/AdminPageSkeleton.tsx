import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
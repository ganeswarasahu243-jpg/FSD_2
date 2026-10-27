import React from 'react';

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`skeleton-shimmer rounded-xl ${className}`}
      {...props}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="p-5 rounded-2xl border border-slate-200/80 bg-white space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function TableRowSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;

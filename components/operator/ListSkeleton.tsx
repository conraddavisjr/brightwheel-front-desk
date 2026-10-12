export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[16px] bg-surface p-4 ring-1 ring-line-soft">
          <div className="shimmer h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="shimmer h-4 w-2/3 rounded-full" />
            <div className="shimmer h-3 w-1/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

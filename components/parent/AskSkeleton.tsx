/** The parent screen's shape while the session loads: same layout, no jumps. */
export function AskSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <div className="shimmer h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <div className="shimmer h-4 w-48 rounded-full" />
          <div className="shimmer h-3 w-32 rounded-full" />
        </div>
      </div>
      <div className="px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="flex items-center gap-3">
          <div className="shimmer h-11 w-11 rounded-full" />
          <div className="shimmer h-8 w-64 rounded-full" />
        </div>
        <div className="shimmer mt-6 h-4 w-full rounded-full" />
        <div className="shimmer mt-2 h-4 w-3/4 rounded-full" />
        <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="shimmer h-[72px] rounded-[18px]" />
          ))}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[720px] px-4 pb-4 sm:px-6">
        <div className="h-14 rounded-full bg-surface shadow-2 ring-1 ring-line" />
      </div>
    </div>
  );
}

/** The parent home's shape while it loads. */
export function HomeSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <div className="shimmer h-10 w-10 rounded-[11px]" />
        <div className="space-y-1.5">
          <div className="shimmer h-4 w-48 rounded-full" />
          <div className="shimmer h-3 w-32 rounded-full" />
        </div>
      </div>
      <div className="px-4 pt-5 sm:px-6 sm:pt-8">
        <div className="flex items-center gap-3">
          <div className="shimmer h-12 w-12 rounded-full" />
          <div className="shimmer h-8 w-64 rounded-full" />
        </div>
        <div className="shimmer mt-6 h-[190px] rounded-[24px]" />
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="shimmer h-10 w-24 rounded-full" />
          ))}
        </div>
        <div className="shimmer mt-9 h-5 w-44 rounded-full" />
        <div className="shimmer mt-3 h-40 rounded-[20px]" />
        <div className="shimmer mt-9 h-5 w-44 rounded-full" />
        <div className="shimmer mt-3 h-48 rounded-[20px]" />
      </div>
    </div>
  );
}

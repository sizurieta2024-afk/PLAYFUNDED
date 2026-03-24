export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background p-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 rounded-md bg-muted mb-2" />
        <div className="h-4 w-72 rounded-md bg-muted/60" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="h-3 w-20 rounded bg-muted mb-3" />
            <div className="h-7 w-28 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-32 rounded bg-muted" />
              <div className="h-5 w-16 rounded-full bg-muted" />
            </div>
            <div className="space-y-3">
              <div className="h-3 w-full rounded bg-muted/60" />
              <div className="h-3 w-5/6 rounded bg-muted/60" />
              <div className="h-3 w-4/6 rounded bg-muted/60" />
            </div>
            <div className="mt-5 h-9 w-full rounded-lg bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}

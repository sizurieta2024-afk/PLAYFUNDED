export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-background p-6 animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-40 rounded-md bg-muted mb-2" />
        <div className="h-4 w-64 rounded-md bg-muted/60" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="h-3 w-20 rounded bg-muted mb-3" />
            <div className="h-7 w-28 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-4 flex-1 rounded bg-muted/60" />
              <div className="h-4 w-24 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

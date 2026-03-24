export default function ChallengeDetailLoading() {
  return (
    <div className="min-h-screen bg-background p-6 animate-pulse">
      {/* Back link */}
      <div className="h-4 w-24 rounded bg-muted mb-6" />

      {/* Challenge header */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="h-6 w-40 rounded bg-muted mb-2" />
            <div className="h-4 w-24 rounded bg-muted/60" />
          </div>
          <div className="h-7 w-20 rounded-full bg-muted" />
        </div>
        {/* Progress bars */}
        <div className="space-y-4 mt-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="flex justify-between mb-1.5">
                <div className="h-3 w-28 rounded bg-muted/60" />
                <div className="h-3 w-14 rounded bg-muted/60" />
              </div>
              <div className="h-2 rounded-full bg-muted/40" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="h-5 w-32 rounded bg-muted mb-4" />
        <div className="h-48 rounded-lg bg-muted/30" />
      </div>

      {/* Picks table skeleton */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="h-5 w-24 rounded bg-muted mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-20 rounded bg-muted/60" />
              <div className="h-4 flex-1 rounded bg-muted/40" />
              <div className="h-4 w-16 rounded bg-muted/60" />
              <div className="h-5 w-14 rounded-full bg-muted/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

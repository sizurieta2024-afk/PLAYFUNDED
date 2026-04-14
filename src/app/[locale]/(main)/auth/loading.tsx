export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 animate-pulse">
      <div className="w-full max-w-md">
        <div className="h-8 w-48 rounded-md bg-muted mx-auto mb-6" />
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="h-10 w-full rounded-lg bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted/60" />
        </div>
      </div>
    </div>
  );
}

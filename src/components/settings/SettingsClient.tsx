"use client";

import { useLocale } from "next-intl";
import { createBrowserClient } from "@supabase/ssr";

interface Props {
  email: string;
  name: string | null;
}

export function SettingsClient({ email, name }: Props) {
  const locale = useLocale();

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    window.location.href = `/${locale}/auth/login`;
  }

  return (
    <div className="space-y-8">
      {/* ── Profile ────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium">{email}</p>
          </div>
          {name && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-sm font-medium">{name}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Sign out ───────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-6 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Sign out</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sign out of your account on this device.
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:border-red-500/50 hover:text-red-400 text-muted-foreground transition-colors"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}

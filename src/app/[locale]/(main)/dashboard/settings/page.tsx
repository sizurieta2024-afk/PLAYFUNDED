import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import { getSettings } from "@/app/actions/settings";
import { SettingsClient } from "@/components/settings/SettingsClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) redirect("/auth/login");

  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your account.
        </p>
      </div>

      <SettingsClient email={settings.email} name={settings.name} />
    </div>
  );
}

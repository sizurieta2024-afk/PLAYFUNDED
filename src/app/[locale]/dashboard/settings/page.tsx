import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getSettings } from "@/app/actions/settings";
import { SettingsClient } from "@/components/settings/SettingsClient";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  return { title: t("pageTitle") };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;

  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/auth/login");

  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your account preferences
        </p>
      </div>

      <SettingsClient
        email={settings.email}
        name={settings.name}
        weeklyDepositLimitUsd={settings.weeklyDepositLimitUsd}
        selfExcludedUntil={settings.selfExcludedUntil}
        isPermExcluded={settings.isPermExcluded}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getSettings } from "@/app/actions/settings";
import { SettingsClient } from "@/components/settings/SettingsClient";
import type { Metadata } from "next";
import { buildLoginPath } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });

  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) redirect(buildLoginPath(locale));

  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {t("pageDescription")}
        </p>
      </div>

      <SettingsClient email={settings.email} name={settings.name} />
    </div>
  );
}

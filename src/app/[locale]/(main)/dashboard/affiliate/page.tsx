import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { buildDashboardPath } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "en" ? "Dashboard | PlayFunded" : "Dashboard | PlayFunded",
  };
}

export default async function AffiliateDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(buildDashboardPath(locale));
}

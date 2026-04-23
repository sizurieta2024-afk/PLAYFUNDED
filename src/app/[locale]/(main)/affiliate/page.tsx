import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { buildLocalePath } from "@/i18n/navigation";
import { withBrandMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return withBrandMetadata({
    title: locale === "en" ? "Challenges | PlayFunded" : "Desafios | PlayFunded",
  });
}

export default async function AffiliatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(buildLocalePath(locale, "/challenges"));
}

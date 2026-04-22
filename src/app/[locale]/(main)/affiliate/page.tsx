import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { buildLocalePath } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "en" ? "Challenges | PlayFunded" : "Desafios | PlayFunded",
  };
}

export default async function AffiliatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(buildLocalePath(locale, "/challenges"));
}

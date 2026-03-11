import { Link } from "@/i18n/navigation";
import { headers } from "next/headers";
import { resolveCountry } from "@/lib/country-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import type { Metadata } from "next";

type LocaleKey = "es-419" | "en" | "pt-BR";

const COPY: Record<
  LocaleKey,
  {
    title: string;
    subtitle: string;
    p1: string;
    p2: string;
    review: string;
  }
> = {
  "es-419": {
    title: "Programa de Afiliados",
    subtitle: "Gana comisiones por referir nuevos traders",
    p1: "Comparte tu enlace y recibe comisión por conversiones válidas.",
    p2: "Los afiliados activos pueden escalar su comisión según desempeño.",
    review:
      "La inscripción de afiliados permanece desactivada hasta completar aprobaciones legales, de procesador y de copy para tu mercado.",
  },
  en: {
    title: "Affiliate Program",
    subtitle: "Earn commissions by referring new traders",
    p1: "Share your referral link and earn commission on valid conversions.",
    p2: "Active affiliates can unlock higher commission rates based on performance.",
    review:
      "Affiliate enrollment stays disabled until legal, processor, and copy approvals are complete for your market.",
  },
  "pt-BR": {
    title: "Programa de Afiliados",
    subtitle: "Ganhe comissão ao indicar novos traders",
    p1: "Compartilhe seu link e ganhe comissão por conversões válidas.",
    p2: "Afiliados ativos podem aumentar a comissão de acordo com desempenho.",
    review:
      "O cadastro de afiliados permanece desativado ate concluir as aprovacoes juridicas, de processador e de copy para o seu mercado.",
  },
};

function getCopy(locale: string) {
  if (locale === "en" || locale === "pt-BR" || locale === "es-419") {
    return COPY[locale];
  }
  return COPY["es-419"];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = getCopy(locale);
  return {
    title: `${copy.title} | PlayFunded`,
    description: copy.subtitle,
  };
}

export default async function AffiliatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = getCopy(locale);
  const headersList = await headers();
  const country = resolveCountry(
    headersList.get("x-vercel-ip-country"),
    headersList.get("cf-ipcountry"),
  );
  const policy = await getResolvedCountryPolicy(country);
  const affiliateEnabled = policy.marketing.affiliateProgramEnabled;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-8 space-y-4">
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.subtitle}</p>
        {policy.requiresReviewNotice && (
          <p className="text-sm text-amber-500">{policy.reviewNote}</p>
        )}
        <p className="text-sm text-muted-foreground">{copy.p1}</p>
        <p className="text-sm text-muted-foreground">
          {affiliateEnabled ? copy.p2 : copy.review}
        </p>
        {affiliateEnabled ? (
          <Link
            href="/dashboard/affiliate"
            className="inline-flex items-center rounded-lg bg-pf-brand px-4 py-2 text-sm font-semibold text-white hover:bg-pf-brand/90 transition-colors"
          >
            Dashboard
          </Link>
        ) : null}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { BioLeadCapture } from "@/components/landing/BioLeadCapture";
import { withBrandMetadata } from "@/lib/metadata";
import { Spotlight } from "@/components/landing/Spotlight";
import { GrainOverlay } from "@/components/landing/GrainOverlay";
import { TrendingDown, TrendingUp } from "lucide-react";

type LocaleKey = "es-419" | "en" | "pt-BR";

const BASE_URL = "https://playfunded.lat";
const LOCALE_PREFIX: Record<string, string> = {
  "es-419": "",
  en: "/en",
  "pt-BR": "/pt-BR",
};

const COPY: Record<
  LocaleKey,
  {
    title: string;
    description: string;
    eyebrow: string;
    heading: string;
    headingAccent: string;
    body: string;
    labelLess: string;
    winLess: string;
    labelMore: string;
    winMore: string;
    note: string;
  }
> = {
  "es-419": {
    title: "Empieza con dinero fondeado | PlayFunded",
    description: "Accede a cuentas de hasta $25,000. Menos riesgo, más techo.",
    eyebrow: "Acceso anticipado",
    heading: "La única manera",
    headingAccent: "de ganar en serio.",
    body: "Si pierdes, pierdes mucho menos de lo que perderías normalmente. Si ganas, puedes ganar mucho más con cuentas de hasta $25,000.",
    labelLess: "Menos riesgo",
    winLess: "Si pierdes, pierdes menos",
    labelMore: "Más techo",
    winMore: "Si ganas, ganas mucho más",
    note: "Deja tu email y te avisamos con un descuento en tu primera cuenta.",
  },
  en: {
    title: "Start with funded capital | PlayFunded",
    description: "Access accounts up to $25,000. Less risk, higher ceiling.",
    eyebrow: "Early access",
    heading: "The only way",
    headingAccent: "to win for real.",
    body: "If you lose, you lose much less than you normally would. If you win, you can win much more with accounts up to $25,000.",
    labelLess: "Less risk",
    winLess: "If you lose, you lose less",
    labelMore: "Higher ceiling",
    winMore: "If you win, you win more",
    note: "Leave your email and we'll notify you with a discount on your first account.",
  },
  "pt-BR": {
    title: "Comece com capital fondeado | PlayFunded",
    description: "Acesse contas de até $25,000. Menos risco, mais teto.",
    eyebrow: "Acesso antecipado",
    heading: "A única forma",
    headingAccent: "de ganhar de verdade.",
    body: "Se você perde, perde muito menos do que perderia normalmente. Se ganha, pode ganhar muito mais com contas de até $25,000.",
    labelLess: "Menos risco",
    winLess: "Se perder, perde menos",
    labelMore: "Mais teto",
    winMore: "Se ganhar, ganha muito mais",
    note: "Deixe seu e-mail e avisamos com desconto na sua primeira conta.",
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
  const prefix = LOCALE_PREFIX[locale] ?? "";

  return withBrandMetadata({
    title: copy.title,
    description: copy.description,
    openGraph: {
      title: copy.title,
      description: copy.description,
      type: "website",
      url: `${BASE_URL}${prefix}/empieza`,
    },
  });
}

export default async function BioStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    ref?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  }>;
}) {
  const { locale } = await params;
  const {
    ref,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    utm_term: utmTerm,
  } = await searchParams;
  const copy = getCopy(locale);
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@playfunded.lat";

  return (
    <div className="relative overflow-hidden bg-background">
      <Spotlight />
      <GrainOverlay opacity={0.032} />

      {/* Radial glows matching homepage */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.07)_0%,transparent_65%)] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(255,45,120,0.04)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-[1200px] px-6 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-12 xl:gap-20 items-center min-h-[calc(100vh-56px)] py-20">
          {/* ── LEFT COLUMN ─────────────────────────────── */}
          <div>
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-7 h-px bg-pf-brand flex-shrink-0" />
              <span className="font-mono text-[10px] text-pf-brand uppercase tracking-[0.12em]">
                {copy.eyebrow}
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-serif italic text-[clamp(2.8rem,5vw,5rem)] leading-[1.05] text-foreground">
              {copy.heading}{" "}
              <span className="text-gradient-animated">
                {copy.headingAccent}
              </span>
            </h1>

            {/* Body */}
            <p className="text-[clamp(14px,1.5vw,16px)] text-muted-foreground leading-relaxed max-w-[420px] mt-6">
              {copy.body}
            </p>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 mt-8 max-w-[420px]">
              <div className="group p-4 rounded-xl border border-border hover:border-pf-brand/30 bg-card transition-all duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-3.5 h-3.5 text-pf-brand" />
                  <span className="font-mono text-[9px] text-pf-brand uppercase tracking-[0.12em]">
                    {copy.labelLess}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {copy.winLess}
                </p>
              </div>
              <div className="group p-4 rounded-xl border border-pf-pink/20 hover:border-pf-pink/40 bg-card transition-all duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-pf-pink" />
                  <span className="font-mono text-[9px] text-pf-pink uppercase tracking-[0.12em]">
                    {copy.labelMore}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {copy.winMore}
                </p>
              </div>
            </div>

            {/* Note */}
            <p className="mt-6 max-w-[380px] text-[12px] text-muted-foreground leading-relaxed">
              {copy.note}
            </p>
          </div>

          {/* ── RIGHT COLUMN — Lead capture form ────────── */}
          <div className="relative">
            <div className="absolute -inset-8 bg-[radial-gradient(ellipse,rgba(201,168,76,0.06)_0%,transparent_70%)] pointer-events-none" />
            <BioLeadCapture
              locale={locale}
              attribution={{
                ref,
                utmSource,
                utmMedium,
                utmCampaign,
                utmContent,
                utmTerm,
              }}
              supportEmail={supportEmail}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

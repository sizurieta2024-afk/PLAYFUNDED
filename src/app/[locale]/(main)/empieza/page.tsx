import type { Metadata } from "next";
import { BioLeadCapture } from "@/components/landing/BioLeadCapture";
import { withBrandMetadata } from "@/lib/metadata";

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
    description:
      "Pagina de captura para trafico social antes del lanzamiento completo.",
    eyebrow: "Antes del lanzamiento",
    heading: "La unica manera de ganar es con cuentas fondeadas",
    body: "Miralo asi: si pierdes, pierdes mucho menos de lo que perderias normalmente. Y si ganas, puedes ganar mucho mas al acceder a cuentas de hasta $25,000 dolares.",
    labelLess: "Menos riesgo",
    winLess: "Si pierdes, pierdes menos",
    labelMore: "Más techo",
    winMore: "Si ganas, puedes ganar mucho mas",
    note: "Es un ganar ganar. Dejanos tu pais y tu email.",
  },
  en: {
    title: "Start with funded capital | PlayFunded",
    description: "Social bio capture page before full launch.",
    eyebrow: "Before launch",
    heading: "The only way to win is with funded accounts",
    body: "Think about it this way: if you lose, you lose much less than you normally would. And if you win, you can win much more by accessing accounts of up to $25,000.",
    labelLess: "Less risk",
    winLess: "If you lose, you lose less",
    labelMore: "Higher ceiling",
    winMore: "If you win, you can win more",
    note: "It is a win-win. Leave your country and email.",
  },
  "pt-BR": {
    title: "Comece com capital fondeado | PlayFunded",
    description: "Pagina de captura social antes do lancamento completo.",
    eyebrow: "Antes do lancamento",
    heading: "A unica forma de ganhar e com contas fondeadas",
    body: "Pense assim: se voce perde, perde muito menos do que perderia normalmente. E se ganha, pode ganhar muito mais ao acessar contas de ate $25,000.",
    labelLess: "Menos risco",
    winLess: "Se perder, perde menos",
    labelMore: "Mais teto",
    winMore: "Se ganhar, pode ganhar mais",
    note: "E um ganha-ganha. Deixe seu pais e seu email.",
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
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  const { ref } = await searchParams;
  const copy = getCopy(locale);
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@playfunded.lat";

  return (
    <div className="relative overflow-hidden bg-[#0d130f]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(215,240,98,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(98,255,186,0.12),transparent_24%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:38px_38px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-160px)] max-w-6xl flex-col justify-center gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:gap-14 lg:py-20">
        <section className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d7f062]">
            {copy.eyebrow}
          </p>
          <h1 className="mt-4 max-w-xl text-[clamp(3rem,7vw,5.6rem)] font-black uppercase leading-[0.92] tracking-[-0.05em] text-white">
            {copy.heading}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/76 sm:text-xl">
            {copy.body}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.6rem] border border-white/12 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d7f062]">
                {copy.labelLess}
              </p>
              <p className="mt-3 text-2xl font-black uppercase leading-none text-white">
                {copy.winLess}
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-white/12 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d7f062]">
                {copy.labelMore}
              </p>
              <p className="mt-3 text-2xl font-black uppercase leading-none text-white">
                {copy.winMore}
              </p>
            </div>
          </div>

          <p className="mt-6 max-w-lg text-sm font-medium uppercase tracking-[0.2em] text-white/58">
            {copy.note}
          </p>
        </section>

        <div className="w-full max-w-xl">
          <BioLeadCapture
            locale={locale}
            refCode={ref}
            supportEmail={supportEmail}
          />
        </div>
      </div>
    </div>
  );
}

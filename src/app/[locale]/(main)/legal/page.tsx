import type { Metadata } from "next";
import { headers } from "next/headers";
import { resolveCountry, type CheckoutMethod } from "@/lib/country-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { PLATFORM_POLICY, getPayoutWindowLabel } from "@/lib/platform-policy";
import { withBrandMetadata } from "@/lib/metadata";

type LocaleKey = "es-419" | "en" | "pt-BR";

const COPY: Record<
  LocaleKey,
  {
    title: string;
    subtitle: string;
    termsTitle: string;
    termsBody: string;
    privacyTitle: string;
    privacyBody: string;
    rgTitle: string;
    rgBody: string;
    availabilityTitle: string;
    availabilityBlocked: string;
    availabilityReview: string;
    methodsTitle: string;
    payoutWindowLabel: string;
    purchasesLabel: string;
    payoutsLabel: string;
    unavailableLabel: string;
    cardLabel: string;
    cryptoLabel: string;
    bankTransferLabel: string;
    bitcoinLabel: string;
    support: string;
  }
> = {
  "es-419": {
    title: "Legal",
    subtitle: "Términos, privacidad y juego responsable",
    termsTitle: "Términos y condiciones",
    termsBody: `Al usar PlayFunded aceptas nuestras reglas de evaluación, pagos y uso de la plataforma. Las tarifas de entrada ${PLATFORM_POLICY.commercial.entryFeesRefundable ? "son reembolsables" : "no son reembolsables"}. Todos los pagos a usuarios se liquidan en ${PLATFORM_POLICY.payouts.settlementCurrency}.`,
    privacyTitle: "Política de privacidad",
    privacyBody:
      "Tratamos datos de cuenta, actividad y pagos para operar la plataforma, prevenir fraude y cumplir obligaciones legales.",
    rgTitle: "Juego responsable",
    rgBody: `Ofrecemos información y recursos de apoyo para juego responsable. Las apuestas en vivo no están permitidas y los picks se bloquean ${PLATFORM_POLICY.trading.eventLockMinutes} minutos antes del inicio del evento.`,
    availabilityTitle: "Disponibilidad por país",
    availabilityBlocked:
      "PlayFunded no está disponible en tu país en este momento.",
    availabilityReview:
      "La disponibilidad del producto, los métodos de pago y los pagos se encuentran sujetos a revisión de cumplimiento y pueden cambiar según el país.",
    methodsTitle: "Métodos según tu ubicación",
    payoutWindowLabel: "Ventana de revisión de pagos",
    purchasesLabel: "Compras de desafíos",
    payoutsLabel: "Pagos",
    unavailableLabel: "No disponible",
    cardLabel: "Tarjeta",
    cryptoLabel: "Cripto",
    bankTransferLabel: "Transferencia bancaria",
    bitcoinLabel: "Bitcoin",
    support: "Soporte: support@playfunded.lat",
  },
  en: {
    title: "Legal",
    subtitle: "Terms, privacy and responsible gambling",
    termsTitle: "Terms and conditions",
    termsBody: `By using PlayFunded, you agree to our evaluation, payout and platform usage rules. Entry fees are ${PLATFORM_POLICY.commercial.entryFeesRefundable ? "refundable" : "non-refundable"}. All user payouts are settled in ${PLATFORM_POLICY.payouts.settlementCurrency}.`,
    privacyTitle: "Privacy policy",
    privacyBody:
      "We process account, activity and payment data to operate the platform, prevent fraud and comply with legal obligations.",
    rgTitle: "Responsible gambling",
    rgBody: `We provide responsible gambling information and support resources. Live betting is not permitted and picks lock ${PLATFORM_POLICY.trading.eventLockMinutes} minutes before event start.`,
    availabilityTitle: "Country availability",
    availabilityBlocked:
      "PlayFunded is not available in your country right now.",
    availabilityReview:
      "Product availability, payment methods, and payouts remain subject to compliance review and may change by country.",
    methodsTitle: "Methods for your location",
    payoutWindowLabel: "Payout review window",
    purchasesLabel: "Challenge purchases",
    payoutsLabel: "Payouts",
    unavailableLabel: "Unavailable",
    cardLabel: "Card",
    cryptoLabel: "Crypto",
    bankTransferLabel: "Bank transfer",
    bitcoinLabel: "Bitcoin",
    support: "Support: support@playfunded.lat",
  },
  "pt-BR": {
    title: "Legal",
    subtitle: "Termos, privacidade e jogo responsável",
    termsTitle: "Termos e condições",
    termsBody: `Ao usar a PlayFunded você aceita nossas regras de avaliação, pagamentos e uso da plataforma. As taxas de entrada ${PLATFORM_POLICY.commercial.entryFeesRefundable ? "são reembolsáveis" : "não são reembolsáveis"}. Todos os pagamentos aos usuários são liquidados em ${PLATFORM_POLICY.payouts.settlementCurrency}.`,
    privacyTitle: "Política de privacidade",
    privacyBody:
      "Tratamos dados de conta, atividade e pagamentos para operar a plataforma, prevenir fraude e cumprir obrigações legais.",
    rgTitle: "Jogo responsável",
    rgBody: `Oferecemos informações e recursos de apoio para jogo responsável. Apostas ao vivo não são permitidas e os picks fecham ${PLATFORM_POLICY.trading.eventLockMinutes} minutos antes do início do evento.`,
    availabilityTitle: "Disponibilidade por país",
    availabilityBlocked:
      "A PlayFunded não está disponível no seu país no momento.",
    availabilityReview:
      "A disponibilidade do produto, os métodos de pagamento e os pagamentos seguem sujeitos a revisão de compliance e podem mudar por país.",
    methodsTitle: "Métodos para sua localização",
    payoutWindowLabel: "Janela de revisão de pagamentos",
    purchasesLabel: "Compras de desafios",
    payoutsLabel: "Pagamentos",
    unavailableLabel: "Indisponível",
    cardLabel: "Cartão",
    cryptoLabel: "Cripto",
    bankTransferLabel: "Transferência bancária",
    bitcoinLabel: "Bitcoin",
    support: "Suporte: support@playfunded.lat",
  },
};

function getCopy(locale: string) {
  if (locale === "en" || locale === "pt-BR" || locale === "es-419") {
    return COPY[locale];
  }
  return COPY["es-419"];
}

type LegalCopy = (typeof COPY)[LocaleKey];

function formatCheckoutMethod(
  method: CheckoutMethod,
  copy: LegalCopy,
): string | null {
  switch (method) {
    case "card":
      return copy.cardLabel;
    case "crypto":
      return copy.cryptoLabel;
    case "pix":
      return "Pix";
    case "mercadopago":
      return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = getCopy(locale);
  return withBrandMetadata(
    {
      title: copy.title,
      description: copy.subtitle,
      openGraph: {
        title: copy.title,
        description: copy.subtitle,
        type: "website",
      },
    },
    { locale, path: "/legal" },
  );
}

export default async function LegalPage({
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
  const checkoutMethods = policy.checkoutMethods
    .map((method) => formatCheckoutMethod(method, copy))
    .filter((method): method is string => Boolean(method));
  const payoutMethods = policy.payoutMethods.map((method) =>
    method === "bank_wire"
      ? copy.bankTransferLabel
      : method === "btc"
        ? copy.bitcoinLabel
        : method.toUpperCase(),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-display font-bold font-serif italic">
          {copy.title}
        </h1>
        <p className="text-muted-foreground">{copy.subtitle}</p>
      </header>

      <section className="rounded-xl border border-border bg-card p-6 space-y-2">
        <h2 className="text-lg font-display font-bold font-semibold">
          {copy.termsTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.termsBody}</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-2">
        <h2 className="text-lg font-display font-bold font-semibold">
          {copy.privacyTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.privacyBody}</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-2">
        <h2 className="text-lg font-display font-bold font-semibold">
          {copy.rgTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.rgBody}</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h2 className="text-lg font-display font-bold font-semibold">
          {copy.availabilityTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {policy.marketStatus === "blocked"
            ? copy.availabilityBlocked
            : copy.availabilityReview}
        </p>
        {policy.marketStatus !== "blocked" && (
          <p className="text-sm text-muted-foreground">
            {copy.payoutWindowLabel}: {getPayoutWindowLabel()}
          </p>
        )}
        <p className="text-sm font-medium text-foreground">
          {copy.methodsTitle}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">{copy.purchasesLabel}</p>
            <p>
              {checkoutMethods.length > 0
                ? checkoutMethods.join(", ")
                : copy.unavailableLabel}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">{copy.payoutsLabel}</p>
            <p>
              {policy.payoutMethods.length > 0
                ? payoutMethods.join(", ")
                : copy.unavailableLabel}
            </p>
          </div>
        </div>
      </section>

      <p className="text-sm text-muted-foreground">{copy.support}</p>
    </div>
  );
}

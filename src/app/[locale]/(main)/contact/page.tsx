import type { Metadata } from "next";

type LocaleKey = "es-419" | "en" | "pt-BR";

const COPY: Record<
  LocaleKey,
  { title: string; subtitle: string; emailLabel: string; response: string }
> = {
  "es-419": {
    title: "Contacto",
    subtitle: "Estamos aquí para ayudarte",
    emailLabel: "Correo de soporte",
    response: "Tiempo de respuesta estimado: 24 a 48 horas hábiles.",
  },
  en: {
    title: "Contact",
    subtitle: "We are here to help",
    emailLabel: "Support email",
    response: "Estimated response time: 24 to 48 business hours.",
  },
  "pt-BR": {
    title: "Contato",
    subtitle: "Estamos aqui para ajudar",
    emailLabel: "E-mail de suporte",
    response: "Tempo estimado de resposta: 24 a 48 horas úteis.",
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

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = getCopy(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-8 space-y-4">
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.subtitle}</p>
        <div className="pt-2">
          <p className="text-sm font-medium">{copy.emailLabel}</p>
          <a
            href="mailto:support@playfunded.com"
            className="text-pf-brand hover:underline"
          >
            support@playfunded.com
          </a>
        </div>
        <p className="text-sm text-muted-foreground">{copy.response}</p>
      </div>
    </div>
  );
}

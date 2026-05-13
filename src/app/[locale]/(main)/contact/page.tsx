import type { Metadata } from "next";
import { getDiscordInviteUrl } from "@/lib/public-links";
import { withBrandMetadata } from "@/lib/metadata";

type LocaleKey = "es-419" | "en" | "pt-BR";

const COPY: Record<
  LocaleKey,
  {
    title: string;
    subtitle: string;
    emailLabel: string;
    discordLabel: string;
    discordCta: string;
    response: string;
  }
> = {
  "es-419": {
    title: "Contacto",
    subtitle: "Estamos aquí para ayudarte",
    emailLabel: "Correo de soporte",
    discordLabel: "Discord",
    discordCta: "Unirse al Discord",
    response: "Tiempo de respuesta estimado: 24 a 48 horas hábiles.",
  },
  en: {
    title: "Contact",
    subtitle: "We are here to help",
    emailLabel: "Support email",
    discordLabel: "Discord",
    discordCta: "Join Discord",
    response: "Estimated response time: 24 to 48 business hours.",
  },
  "pt-BR": {
    title: "Contato",
    subtitle: "Estamos aqui para ajudar",
    emailLabel: "E-mail de suporte",
    discordLabel: "Discord",
    discordCta: "Entrar no Discord",
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
    { locale, path: "/contact" },
  );
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = getCopy(locale);
  const discordInviteUrl = getDiscordInviteUrl();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-8 space-y-4">
        <h1 className="text-3xl font-display font-bold font-serif italic">
          {copy.title}
        </h1>
        <p className="text-muted-foreground">{copy.subtitle}</p>
        <div className="pt-2">
          <p className="text-sm font-medium">{copy.emailLabel}</p>
          <a
            href="mailto:support@playfunded.lat"
            className="text-pf-brand hover:underline"
          >
            support@playfunded.lat
          </a>
        </div>
        {discordInviteUrl ? (
          <div className="pt-2">
            <p className="text-sm font-medium">{copy.discordLabel}</p>
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-pf-brand hover:underline"
            >
              {copy.discordCta}
            </a>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">{copy.response}</p>
      </div>
    </div>
  );
}

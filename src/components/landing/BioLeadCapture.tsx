"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check } from "lucide-react";

type LocaleKey = "es-419" | "en" | "pt-BR";

type Copy = {
  emailLabel: string;
  countryLabel: string;
  button: string;
  loading: string;
  supportLabel: string;
  successTitle: string;
  successBody: string;
  error: string;
};

type Attribution = {
  ref?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

const COPY: Record<LocaleKey, Copy> = {
  "es-419": {
    emailLabel: "Email",
    countryLabel: "País",
    button: "Conseguir descuento en mi primera cuenta",
    loading: "Enviando...",
    supportLabel: "Dudas",
    successTitle: "¡Listo!",
    successBody:
      "Te contactaremos con tu descuento en cuanto la plataforma esté lista.",
    error:
      "No pudimos enviar tu registro ahora mismo. Inténtalo otra vez en un momento.",
  },
  en: {
    emailLabel: "Email",
    countryLabel: "Country",
    button: "Get a discount on my first account",
    loading: "Sending...",
    supportLabel: "Questions",
    successTitle: "You're in!",
    successBody:
      "We'll contact you with your discount as soon as the platform is ready.",
    error:
      "We could not submit your request right now. Please try again shortly.",
  },
  "pt-BR": {
    emailLabel: "E-mail",
    countryLabel: "País",
    button: "Conseguir desconto na minha primeira conta",
    loading: "Enviando...",
    supportLabel: "Dúvidas",
    successTitle: "Pronto!",
    successBody:
      "Entraremos em contato com seu desconto assim que a plataforma estiver pronta.",
    error: "Não foi possível enviar agora. Tente novamente em instantes.",
  },
};

const COUNTRY_OPTIONS = [
  { value: "MX", label: "México" },
  { value: "AR", label: "Argentina" },
  { value: "CO", label: "Colombia" },
  { value: "CL", label: "Chile" },
  { value: "PE", label: "Perú" },
  { value: "EC", label: "Ecuador" },
  { value: "UY", label: "Uruguay" },
  { value: "PY", label: "Paraguay" },
  { value: "ES", label: "España" },
  { value: "BR", label: "Brasil" },
  { value: "OTRO", label: "Otro" },
];

function getCopy(locale: string): Copy {
  if (locale === "en" || locale === "pt-BR" || locale === "es-419") {
    return COPY[locale];
  }
  return COPY["es-419"];
}

export function BioLeadCapture({
  locale,
  attribution,
  supportEmail,
}: {
  locale: string;
  attribution?: Attribution;
  supportEmail: string;
}) {
  const copy = useMemo(() => getCopy(locale), [locale]);
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("MX");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bio-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          country,
          locale,
          ref: attribution?.ref ?? "",
          utmSource: attribution?.utmSource ?? "",
          utmMedium: attribution?.utmMedium ?? "",
          utmCampaign: attribution?.utmCampaign ?? "",
          utmContent: attribution?.utmContent ?? "",
          utmTerm: attribution?.utmTerm ?? "",
        }),
      });
      if (!response.ok) throw new Error("submit_failed");
      setSuccess(true);
    } catch {
      setError(copy.error);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="animate-float rounded-lg border border-pf-brand/30 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.3)] p-8">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-pf-brand/10 border border-pf-brand/20 mb-5">
          <Check className="w-5 h-5 text-pf-brand" />
        </div>
        <p className="font-mono text-[10px] text-pf-brand uppercase tracking-[0.1em] mb-2">
          {copy.successTitle}
        </p>
        <p className="text-foreground font-semibold text-lg leading-snug mb-4">
          {copy.successBody}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {copy.supportLabel}:{" "}
          <a
            href={`mailto:${supportEmail}`}
            className="text-pf-brand hover:text-pf-gold-light transition-colors"
          >
            {supportEmail}
          </a>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-float rounded-lg border border-pf-brand/20 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.3)] p-7"
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-6">
        <span className="font-mono text-[10px] text-pf-brand uppercase tracking-[0.1em]">
          Early access
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-[5px] h-[5px] rounded-full bg-pf-pink animate-pulse" />
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
            Descuento disponible
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Country */}
        <div>
          <label className="block font-mono text-[9px] text-muted-foreground uppercase tracking-[0.1em] mb-2">
            {copy.countryLabel}
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded bg-secondary border border-border px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-pf-brand/50 focus:ring-1 focus:ring-pf-brand/20"
          >
            {COUNTRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Email */}
        <div>
          <label className="block font-mono text-[9px] text-muted-foreground uppercase tracking-[0.1em] mb-2">
            {copy.emailLabel}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tu@email.com"
            className="w-full rounded bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition focus:border-pf-brand/50 focus:ring-1 focus:ring-pf-brand/20"
          />
        </div>

        {/* CTA */}
        <button
          type="submit"
          disabled={loading}
          className="press group relative w-full overflow-hidden rounded bg-pf-pink hover:bg-pf-pink-dark text-white font-semibold text-[13px] py-3 px-5 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span className="pointer-events-none absolute inset-0 -skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          {loading ? copy.loading : copy.button}
          {!loading && <ArrowRight className="w-3.5 h-3.5 shrink-0" />}
        </button>

        {error && <p className="text-xs text-red-400 font-medium">{error}</p>}

        <p className="text-[11px] text-muted-foreground text-center">
          {copy.supportLabel}:{" "}
          <a
            href={`mailto:${supportEmail}`}
            className="text-pf-brand hover:text-pf-gold-light transition-colors"
          >
            {supportEmail}
          </a>
        </p>
      </div>
    </form>
  );
}

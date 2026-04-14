"use client";

import { useMemo, useState } from "react";

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

const COPY: Record<LocaleKey, Copy> = {
  "es-419": {
    emailLabel: "Email",
    countryLabel: "Pais",
    button: "Haz click aqui para conseguir un descuento en tu primera cuenta fondeada",
    loading: "Enviando...",
    supportLabel: "Dudas",
    successTitle: "Gracias",
    successBody:
      "Apenas este lista la pagina te contactaremos para que la uses con tu descuento.",
    error:
      "No pudimos enviar tu registro ahora mismo. Intentalo otra vez en un momento.",
  },
  en: {
    emailLabel: "Email",
    countryLabel: "Country",
    button: "Click here to get a discount on your first funded account",
    loading: "Sending...",
    supportLabel: "Questions",
    successTitle: "Thank you",
    successBody:
      "As soon as the page is ready, we will contact you so you can use it with your discount.",
    error: "We could not submit your request right now. Please try again shortly.",
  },
  "pt-BR": {
    emailLabel: "E-mail",
    countryLabel: "Pais",
    button: "Clique aqui para conseguir desconto na sua primeira conta fondeada",
    loading: "Enviando...",
    supportLabel: "Duvidas",
    successTitle: "Obrigado",
    successBody:
      "Assim que a pagina estiver pronta, entraremos em contato para que voce use com seu desconto.",
    error: "Nao foi possivel enviar agora. Tente novamente em instantes.",
  },
};

const COUNTRY_OPTIONS = [
  { value: "MX", label: "Mexico" },
  { value: "AR", label: "Argentina" },
  { value: "CO", label: "Colombia" },
  { value: "CL", label: "Chile" },
  { value: "PE", label: "Peru" },
  { value: "EC", label: "Ecuador" },
  { value: "UY", label: "Uruguay" },
  { value: "PY", label: "Paraguay" },
  { value: "ES", label: "Espana" },
  { value: "BR", label: "Brasil" },
  { value: "OTRO", label: "Otro" },
];

function getCopy(locale: string) {
  if (locale === "en" || locale === "pt-BR" || locale === "es-419") {
    return COPY[locale];
  }
  return COPY["es-419"];
}

export function BioLeadCapture({
  locale,
  refCode,
  supportEmail,
}: {
  locale: string;
  refCode?: string;
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
          ref: refCode ?? "",
        }),
      });

      if (!response.ok) {
        throw new Error("submit_failed");
      }

      setSuccess(true);
    } catch {
      setError(copy.error);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-[2rem] border border-white/15 bg-black/35 p-6 sm:p-8 text-left shadow-2xl backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d7f062]">
          {copy.successTitle}
        </p>
        <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.03em] text-white sm:text-4xl">
          {copy.successBody}
        </h2>
        <p className="mt-4 text-sm font-medium text-white/75">
          {copy.supportLabel}:{" "}
          <a className="text-[#d7f062] underline-offset-4 hover:underline" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-white/15 bg-black/35 p-6 sm:p-8 shadow-2xl backdrop-blur"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
            {copy.countryLabel}
          </label>
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-base font-medium text-white outline-none transition focus:border-[#d7f062]"
          >
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="text-black">
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
            {copy.emailLabel}
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="tu@email.com"
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-base font-medium text-white placeholder:text-white/35 outline-none transition focus:border-[#d7f062]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-[#d7f062] px-5 py-4 text-sm font-black uppercase tracking-[0.08em] text-[#1b2413] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? copy.loading : copy.button}
        </button>

        <p className="text-xs leading-relaxed text-white/55">
          {copy.supportLabel}:{" "}
          <a className="text-[#d7f062] underline-offset-4 hover:underline" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
        </p>

        {error ? <p className="text-sm font-medium text-red-300">{error}</p> : null}
      </div>
    </form>
  );
}

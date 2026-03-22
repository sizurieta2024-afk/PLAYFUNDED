"use client";

interface Testimonial {
  name: string;
  handle: string;
  flag: string;
  quote: string;
  tier: string;
  pnl: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Carlos M.",
    handle: "@carlosm_trades",
    flag: "🇲🇽",
    quote:
      "Pasé las dos fases en 3 semanas. El sistema de riesgo me hizo mucho más disciplinado con mis stakes.",
    tier: "Elite",
    pnl: "+$2,840",
  },
  {
    name: "Diego R.",
    handle: "@diegor_bets",
    flag: "🇨🇴",
    quote:
      "Best prop firm I've tried. The NFL markets are sharp and the picks interface is super fast.",
    tier: "Pro",
    pnl: "+$1,240",
  },
  {
    name: "Ana G.",
    handle: "@ana.trading",
    flag: "🇦🇷",
    quote:
      "La plataforma es súper limpia. Pasé al Elite en 45 días y cobré mi primer payout sin problemas.",
    tier: "Elite",
    pnl: "+$3,600",
  },
  {
    name: "Javier L.",
    handle: "@javier_picks",
    flag: "🇨🇱",
    quote:
      "The risk rules kept me disciplined when I would've over-leveraged. Actually made me a better trader.",
    tier: "Master",
    pnl: "+$6,200",
  },
  {
    name: "Marco V.",
    handle: "@marcovega",
    flag: "🇵🇪",
    quote:
      "Started with Starter to test it. Now on Pro. The daily limit rule is actually smart bankroll management.",
    tier: "Pro",
    pnl: "+$890",
  },
  {
    name: "Luis F.",
    handle: "@luisf_nba",
    flag: "🇲🇽",
    quote:
      "NBA picks are chef's kiss. Placed 3 bets in under 5 minutes during halftime. Clean and fast.",
    tier: "Starter",
    pnl: "+$420",
  },
  {
    name: "Sebastián T.",
    handle: "@sebas_mx",
    flag: "🇲🇽",
    quote:
      "The Liga MX coverage is exactly what I needed. Real-time odds and a proper evaluation system.",
    tier: "Elite",
    pnl: "+$1,980",
  },
  {
    name: "Valeria R.",
    handle: "@valer_trades",
    flag: "🇧🇷",
    quote:
      "As a serious bettor, having a firm that evaluates skill over luck is exactly what I was looking for.",
    tier: "Legend",
    pnl: "+$12,500",
  },
];

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="flex-shrink-0 w-[300px] mx-3 p-5 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-sm hover:border-pf-brand/20 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-pf-brand/10 border border-pf-brand/20 flex items-center justify-center text-lg leading-none">
            {t.flag}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none mb-0.5">
              {t.name}
            </p>
            <p className="text-[11px] text-muted-foreground">{t.handle}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-mono font-bold text-pf-pink bg-pf-pink/10 px-2 py-0.5 rounded border border-pf-pink/20">
            {t.pnl}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
            {t.tier}
          </span>
        </div>
      </div>

      {/* Quote */}
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        &ldquo;{t.quote}&rdquo;
      </p>
    </div>
  );
}

export function TestimonialsMarquee() {
  const doubled = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <section className="py-20 bg-background border-t border-border overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-8 h-px bg-pf-brand flex-shrink-0" />
          <span className="font-mono text-xs text-pf-brand uppercase tracking-[0.15em]">
            Traders
          </span>
          <div className="w-8 h-px bg-pf-brand flex-shrink-0" />
        </div>
        <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground">
          {/* En producción estos serán traders reales */}
          What traders are saying
        </h2>
        <p className="text-muted-foreground text-sm mt-3">
          From Starter to Legend — real results from real traders.
        </p>
      </div>

      {/* Marquee row */}
      <div className="relative">
        {/* Fade masks */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-background to-transparent z-10" />

        <div
          className="flex animate-ticker"
          style={{ animationDuration: "40s" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.animationPlayState =
              "paused";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.animationPlayState =
              "running";
          }}
        >
          {doubled.map((testimonial, i) => (
            <TestimonialCard key={i} t={testimonial} />
          ))}
        </div>
      </div>
    </section>
  );
}

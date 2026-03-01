"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface FaqItemProps {
  question: string;
  answer: string;
}

function FaqItem({ question, answer }: FaqItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="font-medium text-sm text-foreground">{question}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">
          {answer}
        </p>
      )}
    </div>
  );
}

export default function FaqPage() {
  const t = useTranslations("faq");

  const categories = [
    {
      title: t("cat_general"),
      items: ["q_what", "q_latam", "q_real_money"] as const,
    },
    {
      title: t("cat_challenge"),
      items: ["q_phases", "q_fail", "q_retry", "q_min_picks"] as const,
    },
    {
      title: t("cat_rules"),
      items: ["q_drawdown", "q_daily_reset", "q_stake_limit"] as const,
    },
    {
      title: t("cat_payout"),
      items: ["q_payout_when", "q_kyc", "q_methods", "q_time"] as const,
    },
    {
      title: t("cat_other"),
      items: ["q_affiliate", "q_gift", "q_sports"] as const,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-12">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      <div className="space-y-8">
        {categories.map(({ title, items }) => (
          <section key={title}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {title}
            </h2>
            <div className="rounded-xl border border-border bg-card px-5 divide-y divide-border">
              {items.map((key) => (
                <FaqItem
                  key={key}
                  question={t(`${key}_q` as Parameters<typeof t>[0])}
                  answer={t(`${key}_a` as Parameters<typeof t>[0])}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="text-center rounded-xl border border-border bg-card/50 p-8 space-y-3">
        <p className="font-semibold">{t("contact_title")}</p>
        <p className="text-sm text-muted-foreground">{t("contact_desc")}</p>
        <Link
          href="mailto:support@playfunded.com"
          className="inline-block px-5 py-2 rounded-lg bg-pf-brand text-white text-sm font-semibold hover:bg-pf-brand/90 transition-colors"
        >
          {t("contact_cta")}
        </Link>
      </div>
    </div>
  );
}

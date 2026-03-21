import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveCountry } from "@/lib/country-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { PLATFORM_POLICY, getPayoutWindowLabel } from "@/lib/platform-policy";

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faq" });
  const headersList = await headers();
  const country = resolveCountry(
    headersList.get("x-vercel-ip-country"),
    headersList.get("cf-ipcountry"),
  );
  const policy = await getResolvedCountryPolicy(country);
  const hasExactCommercialTerms = policy.marketing.showExactCommercialTerms;

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

  function getAnswer(key: string): string {
    switch (key) {
      case "q_what":
        return t(
          hasExactCommercialTerms ? "q_what_a" : "q_what_a_review",
          {
            payoutWindow: getPayoutWindowLabel(),
          },
        );
      case "q_latam":
        return t("q_latam_a_review");
      case "q_real_money":
        return t(
          hasExactCommercialTerms ? "q_real_money_a" : "q_real_money_a_review",
        );
      case "q_retry":
        return t("q_retry_a", {
          refundable: PLATFORM_POLICY.commercial.entryFeesRefundable
            ? t("refundLabel")
            : t("nonRefundableLabel"),
        });
      case "q_payout_when":
        return t(
          hasExactCommercialTerms
            ? "q_payout_when_a"
            : "q_payout_when_a_review",
          {
            payoutWindow: getPayoutWindowLabel(),
          },
        );
      case "q_methods":
        return t(
          policy.marketing.showProcessorNames
            ? "q_methods_a"
            : "q_methods_a_review",
        );
      case "q_time":
        return t(
          hasExactCommercialTerms ? "q_time_a" : "q_time_a_review",
          { payoutWindow: getPayoutWindowLabel() },
        );
      case "q_affiliate":
        return t("q_affiliate_a_review");
      case "q_gift":
        return t(
          policy.marketing.giftsEnabled ? "q_gift_a" : "q_gift_a_review",
        );
      default:
        return t(`${key}_a` as Parameters<typeof t>[0]);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-12">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageSubtitle")}</p>
        {policy.requiresReviewNotice && (
          <p className="text-sm text-amber-500">{t("countryPolicyReview")}</p>
        )}
      </div>

      <div className="space-y-8">
        {categories.map(({ title, items }) => (
          <section key={title}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {title}
            </h2>
            <div className="rounded-xl border border-border bg-card px-5 divide-y divide-border">
              {items.map((key) => (
                <details key={key} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                    <span className="font-medium text-sm text-foreground">
                      {t(`${key}_q` as Parameters<typeof t>[0])}
                    </span>
                    <span className="text-muted-foreground transition-transform group-open:rotate-180">
                      v
                    </span>
                  </summary>
                  <p className="pt-4 text-sm text-muted-foreground leading-relaxed">
                    {getAnswer(key)}
                  </p>
                </details>
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

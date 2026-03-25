import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "affiliate" });

  return {
    title: `${t("publicTitle")} | PlayFunded`,
    description: t("publicSubtitle"),
    openGraph: {
      title: `${t("publicTitle")} | PlayFunded`,
      description: t("publicSubtitle"),
      type: "website",
      url: "https://playfunded.lat/affiliate",
    },
  };
}

export default async function AffiliatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "affiliate" });

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let affiliateStatus: "approved" | "pending" | "available" = "available";

  if (authUser) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: {
        affiliate: { select: { id: true } },
        affiliateApplications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
      },
    });

    if (dbUser?.affiliate) {
      affiliateStatus = "approved";
    } else if (dbUser?.affiliateApplications[0]?.status === "pending") {
      affiliateStatus = "pending";
    }
  }

  const primaryHref =
    authUser ? "/dashboard/affiliate" : "/auth/signup";
  const primaryLabel = !authUser
    ? t("publicSignedOutCta")
    : affiliateStatus === "approved"
      ? t("publicApprovedCta")
      : affiliateStatus === "pending"
        ? t("publicPendingCta")
        : t("publicSignedInCta");

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 space-y-10">
      <section className="rounded-3xl border border-border bg-card/60 p-8 sm:p-10">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pf-brand">
            PlayFunded
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("publicTitle")}
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t("publicSubtitle")}
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("publicReviewNote")}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center rounded-xl bg-pf-pink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-pf-pink-dark"
          >
            {primaryLabel}
          </Link>
          {!authUser ? (
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              {t("publicSecondaryCta")}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: t("publicBenefitOneTitle"),
            description: t("publicBenefitOneDesc"),
          },
          {
            title: t("publicBenefitTwoTitle"),
            description: t("publicBenefitTwoDesc"),
          },
          {
            title: t("publicBenefitThreeTitle"),
            description: t("publicBenefitThreeDesc"),
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-border bg-card p-6 space-y-2"
          >
            <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t("applyTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("applyDesc")}
        </p>
        <p className="text-sm text-muted-foreground">{t("publicStatusNote")}</p>
      </section>
    </div>
  );
}

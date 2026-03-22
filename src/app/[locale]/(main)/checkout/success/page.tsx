import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CheckCircle } from "lucide-react";
import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("successTitle") };
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { locale } = await params;
  const { session_id: sessionId } = await searchParams;
  const t = await getTranslations({ locale, namespace: "checkout" });

  let challengeReady = false;
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (authUser) {
    const user = await prisma.user.findFirst({
      where: { supabaseId: authUser.id },
      select: { id: true },
    });

    if (user) {
      if (sessionId) {
        const payment = await prisma.payment.findFirst({
          where: {
            userId: user.id,
            providerRef: sessionId,
            status: "completed",
          },
          select: { id: true },
        });
        challengeReady = Boolean(payment);
      } else {
        const recentCompletedPayment = await prisma.payment.findFirst({
          where: {
            userId: user.id,
            status: "completed",
            createdAt: {
              gte: new Date(Date.now() - 15 * 60 * 1000),
            },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        challengeReady = Boolean(recentCompletedPayment);
      }
    }
  }

  const title = challengeReady ? t("successTitle") : t("successPendingTitle");
  const subtitle = challengeReady
    ? t("successSubtitle")
    : t("successPendingSubtitle");
  const description = challengeReady
    ? t("successDescription")
    : t("successPendingDescription");

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-pf-brand/10">
            <CheckCircle className="w-10 h-10 text-pf-brand" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground">
            {title}
          </h1>
          <p className="text-lg text-pf-brand font-medium">{subtitle}</p>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3 rounded-xl bg-pf-pink hover:bg-pf-pink-dark text-white font-semibold transition-colors"
        >
          {t("successButton")}
        </Link>
      </div>
    </div>
  );
}

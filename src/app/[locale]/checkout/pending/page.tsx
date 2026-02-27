import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Clock } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("pendingTitle") };
}

export default async function CheckoutPendingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/10">
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            {t("pendingTitle")}
          </h1>
          <p className="text-lg text-yellow-500 font-medium">
            {t("pendingSubtitle")}
          </p>
          <p className="text-muted-foreground">{t("pendingDescription")}</p>
        </div>

        <Link
          href="/challenges"
          className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3 rounded-xl border border-border hover:bg-muted text-foreground font-semibold transition-colors"
        >
          {t("cancelButton")}
        </Link>
      </div>
    </div>
  );
}

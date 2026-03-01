import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CheckCircle } from "lucide-react";
import type { Metadata } from "next";

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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-pf-brand/10">
            <CheckCircle className="w-10 h-10 text-pf-brand" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            {t("successTitle")}
          </h1>
          <p className="text-lg text-pf-brand font-medium">
            {t("successSubtitle")}
          </p>
          <p className="text-muted-foreground">{t("successDescription")}</p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3 rounded-xl bg-pf-brand hover:bg-pf-brand-dark text-white font-semibold transition-colors"
        >
          {t("successButton")}
        </Link>
      </div>
    </div>
  );
}

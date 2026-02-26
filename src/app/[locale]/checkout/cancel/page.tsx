import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { XCircle } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("cancelTitle") };
}

export default async function CheckoutCancelPage({
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
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-muted">
            <XCircle className="w-10 h-10 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            {t("cancelTitle")}
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            {t("cancelSubtitle")}
          </p>
          <p className="text-muted-foreground">{t("cancelDescription")}</p>
        </div>

        <Link
          href="/challenges"
          className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3 rounded-xl border border-border bg-background hover:bg-secondary text-foreground font-semibold transition-colors"
        >
          {t("cancelButton")}
        </Link>
      </div>
    </div>
  );
}

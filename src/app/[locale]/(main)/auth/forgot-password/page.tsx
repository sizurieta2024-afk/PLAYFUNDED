import { getTranslations } from "next-intl/server";
import { ForgotPasswordClient } from "@/components/auth/ForgotPasswordClient";

export default async function ForgotPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth.forgot" });

  const pageError =
    error === "invalid_reset_link" ? t("invalidLink") : null;

  return (
    <ForgotPasswordClient
      pageError={pageError}
      copy={{
        title: t("title"),
        description: t("description"),
        emailLabel: t("emailLabel"),
        emailPlaceholder: t("emailPlaceholder"),
        submitButton: t("submitButton"),
        submitLoading: t("submitLoading"),
        sentTitle: t("sentTitle"),
        sentDescription: t("sentDescription"),
        sentTo: t("sentTo"),
        spamHint: t("spamHint"),
        backToLogin: t("backToLogin"),
      }}
    />
  );
}

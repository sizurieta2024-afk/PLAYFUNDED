import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { buildForgotPasswordPath } from "@/lib/auth-verification";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { locale } = await params;
  const { mode } = await searchParams;

  if (mode !== "recovery") {
    redirect(`${buildForgotPasswordPath(locale)}?error=invalid_reset_link`);
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`${buildForgotPasswordPath(locale)}?error=invalid_reset_link`);
  }

  const t = await getTranslations({ locale, namespace: "auth.reset" });

  return (
    <ResetPasswordClient
      copy={{
        title: t("title"),
        description: t("description"),
        passwordLabel: t("passwordLabel"),
        passwordPlaceholder: t("passwordPlaceholder"),
        confirmLabel: t("confirmLabel"),
        confirmPlaceholder: t("confirmPlaceholder"),
        submitButton: t("submitButton"),
        submitLoading: t("submitLoading"),
        backToLogin: t("backToLogin"),
      }}
    />
  );
}

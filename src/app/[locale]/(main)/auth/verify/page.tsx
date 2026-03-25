import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";
import {
  PENDING_VERIFICATION_COOKIE,
  unsealPendingVerificationState,
} from "@/lib/auth-verification";

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale } = await params;
  const { email: emailParam } = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth.verify" });
  const cookieStore = await cookies();
  const pendingState = unsealPendingVerificationState(
    cookieStore.get(PENDING_VERIFICATION_COOKIE)?.value,
  );

  return (
    <VerifyEmailClient
      email={emailParam ?? pendingState?.email ?? null}
      resendAvailable={Boolean(pendingState)}
      copy={{
        title: t("title"),
        description: t("description"),
        noEmail: t("noEmail"),
        checkSpam: t("checkSpam"),
        checkEmail: t("checkEmail"),
        waitRetry: t("waitRetry"),
        backToLogin: t("backToLogin"),
        sentTo: t("sentTo"),
        resendButton: t("resendButton"),
        resendLoading: t("resendLoading"),
        resendSuccess: t("resendSuccess"),
        resendExpired: t("resendExpired"),
      }}
    />
  );
}

"use client";

import { useState, useTransition, use } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { redeemGift } from "@/app/actions/gift";

export default function RedeemPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const t = useTranslations("gift");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleClaim() {
    setError(null);
    startTransition(async () => {
      const result = await redeemGift(token);
      if (result.error) {
        if (result.error === "auth_required") {
          router.push(`/auth/login?next=/redeem/${token}`);
        } else {
          setError(result.error);
        }
      } else {
        setDone(true);
        setTimeout(() => router.push("/dashboard"), 2000);
      }
    });
  }

  const ERROR_MAP: Record<string, string> = {
    invalid_token: t("errorInvalid"),
    already_claimed: t("errorClaimed"),
    cannot_redeem_own: t("errorOwnGift"),
    tier_not_found: t("errorInvalid"),
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {done ? (
          <>
            <div className="text-5xl">🎉</div>
            <h1 className="text-2xl font-bold text-foreground">{t("claimedTitle")}</h1>
            <p className="text-muted-foreground text-sm">{t("claimedDesc")}</p>
          </>
        ) : (
          <>
            <div className="text-5xl">🎁</div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t("pageTitle")}</h1>
              <p className="text-muted-foreground text-sm mt-1">{t("pageSubtitle")}</p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <p className="text-sm text-red-400">
                  {ERROR_MAP[error] ?? error}
                </p>
              </div>
            )}

            <button
              onClick={handleClaim}
              disabled={pending}
              className="w-full py-3 rounded-xl bg-pf-brand text-white font-semibold hover:bg-pf-brand/90 transition-colors disabled:opacity-50"
            >
              {pending ? t("claiming") : t("claimButton")}
            </button>
            <p className="text-xs text-muted-foreground">{t("loginNote")}</p>
          </>
        )}
      </div>
    </div>
  );
}

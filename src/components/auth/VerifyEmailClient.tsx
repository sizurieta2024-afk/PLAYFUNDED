"use client";

import { useFormState, useFormStatus } from "react-dom";
import { resendVerificationEmail } from "@/app/actions/auth";
import { Link } from "@/i18n/navigation";

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  if (localPart.length <= 2) return `${localPart[0] ?? ""}*@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

function ResendButton({
  label,
  loadingLabel,
  disabled,
}: {
  label: string;
  loadingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? loadingLabel : label}
    </button>
  );
}

export function VerifyEmailClient({
  email,
  resendAvailable,
  copy,
}: {
  email?: string | null;
  resendAvailable: boolean;
  copy: {
    title: string;
    description: string;
    noEmail: string;
    checkSpam: string;
    checkEmail: string;
    waitRetry: string;
    backToLogin: string;
    sentTo: string;
    resendButton: string;
    resendLoading: string;
    resendSuccess: string;
    resendExpired: string;
  };
}) {
  const [state, action] = useFormState(resendVerificationEmail, null);
  const currentEmail = state?.email ?? email;
  const helperMessage =
    state?.success
      ? copy.resendSuccess
      : !resendAvailable
        ? copy.resendExpired
        : null;

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="text-5xl">📧</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {copy.description}
          </p>
          {currentEmail ? (
            <p className="text-xs font-medium text-pf-brand">
              {copy.sentTo}: {maskEmail(currentEmail)}
            </p>
          ) : null}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 text-left space-y-2">
          <p className="text-sm font-medium text-foreground">{copy.noEmail}</p>
          <ul className="space-y-1">
            {[copy.checkSpam, copy.checkEmail, copy.waitRetry].map((item) => (
              <li
                key={item}
                className="text-sm text-muted-foreground flex items-start gap-2"
              >
                <span className="text-pf-brand mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <form action={action}>
            <ResendButton
              label={copy.resendButton}
              loadingLabel={copy.resendLoading}
              disabled={!resendAvailable}
            />
          </form>

          {state?.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : helperMessage ? (
            <p className="text-sm text-muted-foreground">{helperMessage}</p>
          ) : null}
        </div>

        <Link
          href="/auth/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {copy.backToLogin}
        </Link>
      </div>
    </div>
  );
}

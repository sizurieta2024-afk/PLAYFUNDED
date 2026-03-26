"use client";

import { useFormState, useFormStatus } from "react-dom";
import { requestPasswordReset } from "@/app/actions/auth";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  if (localPart.length <= 2) return `${localPart[0] ?? ""}*@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

function SubmitButton({
  submitLabel,
  submitLoading,
}: {
  submitLabel: string;
  submitLoading: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-pf-pink hover:bg-pf-pink-dark text-white font-semibold"
    >
      {pending ? submitLoading : submitLabel}
    </Button>
  );
}

export function ForgotPasswordClient({
  copy,
  pageError,
}: {
  copy: {
    title: string;
    description: string;
    emailLabel: string;
    emailPlaceholder: string;
    submitButton: string;
    submitLoading: string;
    sentTitle: string;
    sentDescription: string;
    sentTo: string;
    spamHint: string;
    backToLogin: string;
  };
  pageError?: string | null;
}) {
  const [state, action] = useFormState(requestPasswordReset, null);
  const submittedEmail = state?.email ?? null;
  const success = Boolean(state?.success);

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
            {success ? copy.sentTitle : copy.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {success ? copy.sentDescription : copy.description}
          </p>
          {success && submittedEmail ? (
            <p className="text-xs font-medium text-pf-brand">
              {copy.sentTo}: {maskEmail(submittedEmail)}
            </p>
          ) : null}
        </div>

        {success ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            {copy.spamHint}
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-foreground text-sm">
                {copy.emailLabel}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={copy.emailPlaceholder}
                className="focus-visible:ring-pf-pink"
              />
            </div>

            {pageError ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                <p className="text-destructive text-sm">{pageError}</p>
              </div>
            ) : null}

            {state?.error ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                <p className="text-destructive text-sm">{state.error}</p>
              </div>
            ) : null}

            <SubmitButton
              submitLabel={copy.submitButton}
              submitLoading={copy.submitLoading}
            />
          </form>
        )}

        <div className="text-center">
          <Link
            href="/auth/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {copy.backToLogin}
          </Link>
        </div>
      </div>
    </div>
  );
}

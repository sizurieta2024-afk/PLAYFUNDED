"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updatePassword } from "@/app/actions/auth";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export function ResetPasswordClient({
  copy,
}: {
  copy: {
    title: string;
    description: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    confirmLabel: string;
    confirmPlaceholder: string;
    submitButton: string;
    submitLoading: string;
    backToLogin: string;
  };
}) {
  const [state, action] = useFormState(updatePassword, null);

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
            {copy.title}
          </h1>
          <p className="text-muted-foreground text-sm">{copy.description}</p>
        </div>

        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-foreground text-sm">
              {copy.passwordLabel}
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder={copy.passwordPlaceholder}
              className="focus-visible:ring-pf-pink"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-foreground text-sm">
              {copy.confirmLabel}
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              placeholder={copy.confirmPlaceholder}
              className="focus-visible:ring-pf-pink"
            />
          </div>

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

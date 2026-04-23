"use server";

import { getTranslations } from "next-intl/server";
import { createServerClient, createServiceClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import {
  buildLoginPath,
  buildPasswordResetRedirectUrl,
  buildDashboardPath,
  buildVerificationRedirectUrl,
  normalizeAuthLocale,
  PENDING_VERIFICATION_COOKIE,
  PENDING_VERIFICATION_MAX_AGE_SECONDS,
  sealPendingVerificationState,
  unsealPendingVerificationState,
} from "@/lib/auth-verification";
import { syncAppUserFromAuthUser } from "@/lib/auth-user-sync";
import {
  passwordResetEmail,
  sendRequiredEmail,
  verificationEmail,
} from "@/lib/email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Prisma } from "@prisma/client";

type ActionResult = {
  error?: string;
  code?: string;
  success?: boolean;
  email?: string;
} | null;

type VerificationState = {
  email: string;
  password: string;
  name?: string | null;
  locale: string;
};

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isDuplicateAuthError(message: string): boolean {
  const value = message.toLowerCase();
  return (
    value.includes("already registered") ||
    value.includes("already been registered") ||
    value.includes("user already registered") ||
    value.includes("duplicate key")
  );
}

function isEmailNotConfirmedError(error: { message?: string; code?: string }) {
  const code = error.code?.toLowerCase();
  const message = error.message?.toLowerCase() ?? "";
  return code === "email_not_confirmed" || message.includes("email not confirmed");
}

function isAuthUserMissingError(message?: string) {
  const value = message?.toLowerCase() ?? "";
  return (
    value.includes("user not found") ||
    value.includes("unable to find") ||
    value.includes("no user found") ||
    value.includes("email not found")
  );
}

async function resolveActionLocale() {
  const headersList = await headers();
  const referer = headersList.get("referer");
  if (referer) {
    try {
      const [, maybeLocale] = new URL(referer).pathname.split("/");
      if (maybeLocale === "en" || maybeLocale === "pt-BR" || maybeLocale === "es-419") {
        return maybeLocale;
      }
    } catch {
      // Fall back to cookie/default locale when referer parsing fails.
    }
  }

  const cookieStore = await cookies();
  return normalizeAuthLocale(cookieStore.get("NEXT_LOCALE")?.value);
}

async function writePendingVerificationCookie(state: {
  email: string;
  password: string;
  name?: string | null;
  locale: string;
}) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: PENDING_VERIFICATION_COOKIE,
    value: sealPendingVerificationState({
      ...state,
      createdAt: Date.now(),
    }),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_VERIFICATION_MAX_AGE_SECONDS,
  });
}

async function clearPendingVerificationCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: PENDING_VERIFICATION_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

async function getRequestClientKey(scope: string, email: string) {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") ||
    headersList.get("x-vercel-forwarded-for") ||
    "unknown";
  const userAgent = (headersList.get("user-agent") ?? "unknown").slice(0, 120);
  return `${scope}:${ip}:${userAgent}:${email}`;
}

async function enforceRateLimit(
  email: string,
  scope: string,
  routeKey: string,
  unavailableCode: string,
): Promise<ActionResult> {
  const bucketKey = await getRequestClientKey(scope, email);
  const now = new Date();
  const resetAt = new Date(now.getTime() + 10 * 60 * 1000);

  const rows = await prisma.$queryRaw<
    Array<{ count: number; resetAt: Date }>
  >(Prisma.sql`
    INSERT INTO "RateLimitBucket" (
      "key",
      "routeKey",
      "clientKey",
      "count",
      "resetAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${bucketKey},
      ${routeKey},
      ${bucketKey},
      1,
      ${resetAt},
      ${now},
      ${now}
    )
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `);

  const bucket = rows[0];
  if (!bucket) {
    return { code: unavailableCode };
  }

  if (bucket.count > 5) {
    return { code: "RATE_LIMITED" };
  }

  return null;
}

async function enforceSignupGuard(email: string): Promise<ActionResult> {
  return enforceRateLimit(
    email,
    "signup",
    "action:auth:signup",
    "SIGNUP_UNAVAILABLE",
  );
}

async function enforcePasswordResetGuard(email: string): Promise<ActionResult> {
  return enforceRateLimit(
    email,
    "password-reset",
    "action:auth:password-reset",
    "PASSWORD_RESET_UNAVAILABLE",
  );
}

async function generateVerificationSignupLink(
  adminSupabase: ReturnType<typeof createServiceClient>,
  state: VerificationState,
) {
  return adminSupabase.auth.admin.generateLink({
    type: "signup",
    email: state.email,
    password: state.password,
    options: {
      redirectTo: buildVerificationRedirectUrl(state.locale),
      ...(state.name ? { data: { full_name: state.name } } : {}),
    },
  });
}

async function sendVerificationEmailForState(
  state: VerificationState,
  actionLink: string,
) {
  const { subject, html } = verificationEmail(
    state.name ?? null,
    actionLink,
    state.locale,
  );
  await sendRequiredEmail(state.email, subject, html);
}

export async function signInWithEmail(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: "auth.login" });
  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = formData.get("password") as string;

  if (!email || !password) {
    return {
      error: t("missingFields"),
      code: "MISSING_FIELDS",
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (isEmailNotConfirmedError(error)) {
      await writePendingVerificationCookie({ email, password, locale });
      return {
        error: t("emailNotConfirmed"),
        code: "EMAIL_NOT_CONFIRMED",
        email,
      };
    }

    return {
      error: t("invalidCredentials"),
      code: "INVALID_CREDENTIALS",
    };
  }

  if (data.user) {
    try {
      await syncAppUserFromAuthUser(data.user);
    } catch (syncError) {
      console.error("[auth/login] sync failed:", syncError);
      return {
        error: t("loginError"),
        code: "LOGIN_SYNC_ERROR",
      };
    }
  }

  await clearPendingVerificationCookie();
  redirect(buildDashboardPath(locale));
}

export async function signUpWithEmail(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: "auth.signup" });
  const signupState: VerificationState = {
    email: normalizeEmail((formData.get("email") as string) ?? ""),
    password: formData.get("password") as string,
    name: (formData.get("name") as string | null) || undefined,
    locale,
  };
  const { email, password } = signupState;

  if (!email || !password) {
    return {
      error: t("missingFields"),
      code: "MISSING_FIELDS",
    };
  }

  if (!looksLikeEmail(email)) {
    return {
      error: t("invalidEmail"),
      code: "INVALID_EMAIL",
    };
  }

  if (password.length < 8) {
    return {
      error: t("weakPassword"),
      code: "WEAK_PASSWORD",
    };
  }

  const signupGuard = await enforceSignupGuard(email);
  if (signupGuard?.code === "RATE_LIMITED") {
    return { error: t("rateLimited"), code: "RATE_LIMITED" };
  }
  if (signupGuard?.code) {
    return { error: t("signupUnavailable"), code: signupGuard.code };
  }

  const adminSupabase = createServiceClient();
  const { data, error } = await generateVerificationSignupLink(
    adminSupabase,
    signupState,
  );

  if (error) {
    if (isDuplicateAuthError(error.message)) {
      return { error: t("emailExists"), code: "EMAIL_EXISTS" };
    }

    console.error("[auth/signup] generate link failed:", error);
    return { error: t("signupError"), code: "SIGNUP_ERROR" };
  }

  if (!data.user || !data.properties?.action_link) {
    return {
      error: t("signupError"),
      code: "SIGNUP_ERROR",
    };
  }

  try {
    await sendVerificationEmailForState(signupState, data.properties.action_link);
  } catch (sendError) {
    console.error("[auth/signup] verification email failed:", sendError);
    await adminSupabase.auth.admin.deleteUser(data.user.id).catch(() => {});
    return {
      error: t("verificationSendError"),
      code: "VERIFICATION_SEND_FAILED",
    };
  }

  await writePendingVerificationCookie(signupState);

  return {
    success: true,
    code: "VERIFY_EMAIL_SENT",
    email,
  };
}

export async function resendVerificationEmail(): Promise<ActionResult> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: "auth.verify" });
  const cookieStore = await cookies();
  const pendingState = unsealPendingVerificationState(
    cookieStore.get(PENDING_VERIFICATION_COOKIE)?.value,
  );

  if (!pendingState) {
    return {
      error: t("resendExpired"),
      code: "RESEND_EXPIRED",
    };
  }

  const adminSupabase = createServiceClient();
  const verificationState: VerificationState = {
    email: pendingState.email,
    password: pendingState.password,
    name: pendingState.name,
    locale: pendingState.locale,
  };
  const { data, error } = await generateVerificationSignupLink(
    adminSupabase,
    verificationState,
  );

  if (error || !data?.properties?.action_link) {
    console.error("[auth/signup] resend verification failed:", error);
    return {
      error: t("resendError"),
      code: "RESEND_FAILED",
      email: pendingState.email,
    };
  }

  try {
    await sendVerificationEmailForState(
      verificationState,
      data.properties.action_link,
    );
  } catch (sendError) {
    console.error("[auth/signup] resend email delivery failed:", sendError);
    return {
      error: t("resendError"),
      code: "RESEND_FAILED",
      email: pendingState.email,
    };
  }

  await writePendingVerificationCookie(verificationState);

  return {
    success: true,
    code: "VERIFY_EMAIL_RESENT",
    email: pendingState.email,
  };
}

export async function requestPasswordReset(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: "auth.forgot" });
  const email = normalizeEmail((formData.get("email") as string) ?? "");

  if (!email) {
    return {
      error: t("missingEmail"),
      code: "MISSING_EMAIL",
    };
  }

  if (!looksLikeEmail(email)) {
    return {
      error: t("invalidEmail"),
      code: "INVALID_EMAIL",
    };
  }

  const resetGuard = await enforcePasswordResetGuard(email);
  if (resetGuard?.code === "RATE_LIMITED") {
    return { error: t("rateLimited"), code: "RATE_LIMITED" };
  }
  if (resetGuard?.code) {
    return { error: t("sendError"), code: resetGuard.code };
  }

  const adminSupabase = createServiceClient();
  const { data, error } = await adminSupabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: buildPasswordResetRedirectUrl(locale),
    },
  });

  if (error) {
    if (isAuthUserMissingError(error.message)) {
      return {
        success: true,
        code: "RESET_EMAIL_SENT",
        email,
      };
    }

    console.error("[auth/forgot] generate link failed:", error);
    return {
      error: t("sendError"),
      code: "RESET_SEND_FAILED",
    };
  }

  if (!data?.properties?.action_link) {
    return {
      success: true,
      code: "RESET_EMAIL_SENT",
      email,
    };
  }

  try {
    const { subject, html } = passwordResetEmail(
      (data.user?.user_metadata?.full_name as string | undefined) ??
        (data.user?.user_metadata?.name as string | undefined) ??
        null,
      data.properties.action_link,
      locale,
    );
    await sendRequiredEmail(email, subject, html);
  } catch (sendError) {
    console.error("[auth/forgot] reset email delivery failed:", sendError);
    return {
      error: t("sendError"),
      code: "RESET_SEND_FAILED",
    };
  }

  return {
    success: true,
    code: "RESET_EMAIL_SENT",
    email,
  };
}

export async function updatePassword(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: "auth.reset" });
  const password = (formData.get("password") as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  if (!password || !confirmPassword) {
    return {
      error: t("missingFields"),
      code: "MISSING_FIELDS",
    };
  }

  if (password.length < 8) {
    return {
      error: t("weakPassword"),
      code: "WEAK_PASSWORD",
    };
  }

  if (password !== confirmPassword) {
    return {
      error: t("passwordMismatch"),
      code: "PASSWORD_MISMATCH",
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: t("sessionExpired"),
      code: "SESSION_EXPIRED",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("[auth/reset] password update failed:", error);
    return {
      error: t("updateError"),
      code: "PASSWORD_UPDATE_FAILED",
    };
  }

  await supabase.auth.signOut();
  await clearPendingVerificationCookie();
  redirect(`${buildLoginPath(locale)}?reset=success`);
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  await clearPendingVerificationCookie();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}

"use server";

import { getTranslations } from "next-intl/server";
import { createServerClient, createServiceClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import {
  buildDashboardPath,
  buildVerificationRedirectUrl,
  normalizeAuthLocale,
  PENDING_VERIFICATION_COOKIE,
  PENDING_VERIFICATION_MAX_AGE_SECONDS,
  sealPendingVerificationState,
  unsealPendingVerificationState,
} from "@/lib/auth-verification";
import { syncAppUserFromAuthUser } from "@/lib/auth-user-sync";
import { sendRequiredEmail, verificationEmail } from "@/lib/email";
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

async function enforceSignupGuard(email: string): Promise<ActionResult> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") ||
    headersList.get("x-vercel-forwarded-for") ||
    "unknown";
  const userAgent = (headersList.get("user-agent") ?? "unknown").slice(0, 120);
  const bucketKey = `signup:${ip}:${userAgent}:${email}`;
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
      ${"action:auth:signup"},
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
    return { code: "SIGNUP_UNAVAILABLE" };
  }

  if (bucket.count > 5) {
    return { code: "RATE_LIMITED" };
  }

  return null;
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
  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string | null) || undefined;

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
  const { data, error } = await adminSupabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      redirectTo: buildVerificationRedirectUrl(locale),
      ...(name ? { data: { full_name: name } } : {}),
    },
  });

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
    const { subject, html } = verificationEmail(
      name ?? null,
      data.properties.action_link,
      locale,
    );
    await sendRequiredEmail(email, subject, html);
  } catch (sendError) {
    console.error("[auth/signup] verification email failed:", sendError);
    await adminSupabase.auth.admin.deleteUser(data.user.id).catch(() => {});
    return {
      error: t("verificationSendError"),
      code: "VERIFICATION_SEND_FAILED",
    };
  }

  await writePendingVerificationCookie({
    email,
    password,
    name,
    locale,
  });

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
  const { data, error } = await adminSupabase.auth.admin.generateLink({
    type: "signup",
    email: pendingState.email,
    password: pendingState.password,
    options: {
      redirectTo: buildVerificationRedirectUrl(pendingState.locale),
      ...(pendingState.name
        ? { data: { full_name: pendingState.name } }
        : {}),
    },
  });

  if (error || !data?.properties?.action_link) {
    console.error("[auth/signup] resend verification failed:", error);
    return {
      error: t("resendError"),
      code: "RESEND_FAILED",
      email: pendingState.email,
    };
  }

  try {
    const { subject, html } = verificationEmail(
      pendingState.name ?? null,
      data.properties.action_link,
      pendingState.locale,
    );
    await sendRequiredEmail(pendingState.email, subject, html);
  } catch (sendError) {
    console.error("[auth/signup] resend email delivery failed:", sendError);
    return {
      error: t("resendError"),
      code: "RESEND_FAILED",
      email: pendingState.email,
    };
  }

  await writePendingVerificationCookie({
    email: pendingState.email,
    password: pendingState.password,
    name: pendingState.name,
    locale: pendingState.locale,
  });

  return {
    success: true,
    code: "VERIFY_EMAIL_RESENT",
    email: pendingState.email,
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  await clearPendingVerificationCookie();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}

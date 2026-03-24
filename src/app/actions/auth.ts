"use server";

import { createServerClient, createServiceClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Prisma } from "@prisma/client";

type ActionResult = { error?: string; code?: string; success?: boolean } | null;

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
    return { error: "Signup is temporarily unavailable", code: "SIGNUP_UNAVAILABLE" };
  }

  if (bucket.count > 5) {
    return {
      error: "Too many signup attempts. Please try again in a few minutes.",
      code: "RATE_LIMITED",
    };
  }

  return null;
}

export async function signInWithEmail(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return {
      error: "Email y contraseña son requeridos",
      code: "MISSING_FIELDS",
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error: "Email o contraseña incorrectos",
      code: "INVALID_CREDENTIALS",
    };
  }

  redirect("/dashboard");
}

export async function signUpWithEmail(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string | null) || undefined;

  if (!email || !password) {
    return {
      error: "Email y contraseña son requeridos",
      code: "MISSING_FIELDS",
    };
  }

  if (!looksLikeEmail(email)) {
    return {
      error: "Please enter a valid email address",
      code: "INVALID_EMAIL",
    };
  }

  if (password.length < 8) {
    return {
      error: "La contraseña debe tener al menos 8 caracteres",
      code: "WEAK_PASSWORD",
    };
  }

  const signupGuard = await enforceSignupGuard(email);
  if (signupGuard) {
    return signupGuard;
  }

  const supabase = await createServerClient();
  const adminSupabase = createServiceClient();
  const { data, error } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (error) {
    if (isDuplicateAuthError(error.message)) {
      return { error: "Este email ya está registrado", code: "EMAIL_EXISTS" };
    }
    return { error: error.message, code: "SIGNUP_ERROR" };
  }

  if (!data.user) {
    return {
      error: "Failed to create account",
      code: "SIGNUP_ERROR",
    };
  }

  const signInResult = await supabase.auth.signInWithPassword({ email, password });
  if (signInResult.error) {
    await adminSupabase.auth.admin.deleteUser(data.user.id).catch(() => {});
    return {
      error: "Account was created, but automatic sign-in failed. Please log in manually.",
      code: "AUTO_SIGNIN_FAILED",
    };
  }

  const cookieStore = await cookies();
  const refCode = cookieStore.get("pf_ref")?.value ?? null;
  await prisma.user.upsert({
    where: { supabaseId: data.user.id },
    create: {
      supabaseId: data.user.id,
      email,
      name: name ?? null,
      referredByCode: refCode,
    },
    update: { name: name ?? undefined, email },
  });

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}

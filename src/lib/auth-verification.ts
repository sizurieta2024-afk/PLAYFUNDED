import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getCanonicalAppUrl } from "@/lib/public-origin";

export const PENDING_VERIFICATION_COOKIE = "pf_pending_verification";
export const PENDING_VERIFICATION_MAX_AGE_SECONDS = 20 * 60;

const DEFAULT_LOCALE = "es-419";
const SUPPORTED_LOCALES = new Set(["es-419", "en", "pt-BR"]);
const ALGORITHM = "aes-256-gcm";

export interface PendingVerificationState {
  email: string;
  password: string;
  name?: string | null;
  locale: string;
  createdAt: number;
}

function getCipherKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for auth verification");
  }
  return createHash("sha256").update(secret).digest();
}

export function normalizeAuthLocale(value?: string | null): string {
  if (value && SUPPORTED_LOCALES.has(value)) {
    return value;
  }
  return DEFAULT_LOCALE;
}

export function buildDashboardPath(locale: string): string {
  const normalized = normalizeAuthLocale(locale);
  return normalized === DEFAULT_LOCALE
    ? "/dashboard"
    : `/${normalized}/dashboard`;
}

export function buildAuthPath(locale: string, path: string): string {
  const normalized = normalizeAuthLocale(locale);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalized === DEFAULT_LOCALE
    ? normalizedPath
    : `/${normalized}${normalizedPath}`;
}

export function buildLoginPath(locale: string): string {
  return buildAuthPath(locale, "/auth/login");
}

export function buildForgotPasswordPath(locale: string): string {
  return buildAuthPath(locale, "/auth/forgot-password");
}

export function buildResetPasswordPath(locale: string): string {
  return buildAuthPath(locale, "/auth/reset-password?mode=recovery");
}

export function buildVerificationRedirectUrl(locale: string): string {
  const appUrl = getCanonicalAppUrl();
  const next = buildDashboardPath(locale);
  return `${appUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function buildPasswordResetRedirectUrl(locale: string): string {
  const appUrl = getCanonicalAppUrl();
  const next = buildResetPasswordPath(locale);
  return `${appUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function sealPendingVerificationState(
  state: PendingVerificationState,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getCipherKey(), iv);
  const payload = Buffer.from(JSON.stringify(state), "utf8");
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function unsealPendingVerificationState(
  value?: string | null,
): PendingVerificationState | null {
  if (!value) return null;

  try {
    const [ivPart, tagPart, encryptedPart] = value.split(".");
    if (!ivPart || !tagPart || !encryptedPart) return null;

    const decipher = createDecipheriv(
      ALGORITHM,
      getCipherKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]);

    const parsed = JSON.parse(decrypted.toString("utf8")) as PendingVerificationState;
    if (
      !parsed.email ||
      !parsed.password ||
      !parsed.createdAt ||
      Date.now() - parsed.createdAt >
        PENDING_VERIFICATION_MAX_AGE_SECONDS * 1000
    ) {
      return null;
    }

    return {
      ...parsed,
      locale: normalizeAuthLocale(parsed.locale),
    };
  } catch {
    return null;
  }
}

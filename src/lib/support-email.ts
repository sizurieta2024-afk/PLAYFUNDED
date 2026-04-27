const DEFAULT_SUPPORT_EMAIL = "support@playfunded.lat";
const RETIRED_SUPPORT_EMAILS = new Set(["support@playfunded.com"]);

export function getSupportEmail(): string {
  const email = process.env.SUPPORT_EMAIL?.trim().toLowerCase();

  if (!email || RETIRED_SUPPORT_EMAILS.has(email)) {
    return DEFAULT_SUPPORT_EMAIL;
  }

  return email;
}

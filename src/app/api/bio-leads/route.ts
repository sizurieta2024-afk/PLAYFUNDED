import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendRequiredEmail } from "@/lib/email";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const payloadSchema = z.object({
  email: z.string().email(),
  country: z.string().min(2).max(64),
  locale: z.string().min(2).max(16).optional(),
  ref: z.string().min(2).max(64).optional(),
});

export async function POST(request: NextRequest) {
  const limit = await enforceRateLimit(request, "api:bio-leads", {
    windowMs: 60_000,
    max: 5,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse("Too many submissions", limit);
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission payload." },
      { status: 400 },
    );
  }

  const { email, country, locale, ref } = parsed.data;
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@playfunded.lat";
  const submittedAt = new Date().toISOString();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const subject = `Nuevo lead desde bio TikTok: ${escapeHtml(email)}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2>Nuevo lead desde la pagina de bio</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Pais:</strong> ${escapeHtml(country)}</p>
      <p><strong>Locale:</strong> ${escapeHtml(locale ?? "es-419")}</p>
      <p><strong>Ref:</strong> ${escapeHtml(ref ?? "sin codigo")}</p>
      <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
      <p><strong>User-Agent:</strong> ${escapeHtml(userAgent)}</p>
      <p><strong>Fecha:</strong> ${submittedAt}</p>
    </div>
  `;

  try {
    await sendRequiredEmail(supportEmail, subject, html);
  } catch (error) {
    console.error("[bio-leads] send failed", error);
    return NextResponse.json(
      { error: "Lead capture is temporarily unavailable." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}

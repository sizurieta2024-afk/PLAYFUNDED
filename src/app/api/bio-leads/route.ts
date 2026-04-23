import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function optionalText(max: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().max(max).optional());
}

const payloadSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  country: z.string().trim().min(2).max(64),
  locale: optionalText(16),
  ref: optionalText(64),
  utmSource: optionalText(80),
  utmMedium: optionalText(80),
  utmCampaign: optionalText(120),
  utmContent: optionalText(120),
  utmTerm: optionalText(120),
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

  const {
    email,
    country,
    locale,
    ref,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
  } = parsed.data;
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@playfunded.lat";
  const submittedAtDate = new Date();
  const submittedAt = submittedAtDate.toISOString();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  let leadId = "";
  try {
    const lead = await prisma.bioLead.upsert({
      where: { email },
      create: {
        email,
        country,
        locale: locale ?? "es-419",
        ref,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        lastSubmittedAt: submittedAtDate,
      },
      update: {
        country,
        locale: locale ?? "es-419",
        ref,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        lastSubmittedAt: submittedAtDate,
        submissionCount: { increment: 1 },
      },
    });
    leadId = lead.id;
  } catch (error) {
    console.error("[bio-leads] persist failed", error);
    return NextResponse.json(
      { error: "Lead capture is temporarily unavailable." },
      { status: 503 },
    );
  }

  const subject = `Nuevo lead desde bio: ${escapeHtml(email)}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2>Nuevo lead desde la pagina de bio</h2>
      <p><strong>Lead ID:</strong> ${escapeHtml(leadId)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Pais:</strong> ${escapeHtml(country)}</p>
      <p><strong>Locale:</strong> ${escapeHtml(locale ?? "es-419")}</p>
      <p><strong>Ref:</strong> ${escapeHtml(ref ?? "sin codigo")}</p>
      <p><strong>UTM Source:</strong> ${escapeHtml(utmSource ?? "sin source")}</p>
      <p><strong>UTM Medium:</strong> ${escapeHtml(utmMedium ?? "sin medium")}</p>
      <p><strong>UTM Campaign:</strong> ${escapeHtml(utmCampaign ?? "sin campaign")}</p>
      <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
      <p><strong>User-Agent:</strong> ${escapeHtml(userAgent)}</p>
      <p><strong>Fecha:</strong> ${submittedAt}</p>
    </div>
  `;

  void sendEmail(supportEmail, subject, html);

  return NextResponse.json({ ok: true, leadId });
}

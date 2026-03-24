import { NextRequest, NextResponse } from "next/server";
import {
  sendEmail,
  welcomeEmail,
  challengePurchasedEmail,
  phase1PassedEmail,
  fundedEmail,
  drawdownWarningEmail,
  challengeFailedEmail,
  payoutRequestedEmail,
  payoutPaidEmail,
  payoutRejectedEmail,
  kycApprovedEmail,
  kycRejectedEmail,
  giftVoucherEmail,
} from "@/lib/email";

const VALID_TEMPLATES = [
  "welcome",
  "challenge_purchased",
  "phase1_passed",
  "funded",
  "drawdown_warning",
  "challenge_failed",
  "payout_requested",
  "payout_paid",
  "payout_rejected",
  "kyc_approved",
  "kyc_rejected",
  "gift_voucher",
  "all",
] as const;

type Template = (typeof VALID_TEMPLATES)[number];

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    to?: string;
    template?: string;
    locale?: string;
  };
  const to = body.to;
  const template = (body.template ?? "all") as Template;
  const locale = body.locale ?? "es-419";

  if (!to || !to.includes("@")) {
    return NextResponse.json(
      { error: "Missing or invalid 'to' email" },
      { status: 400 },
    );
  }

  if (!VALID_TEMPLATES.includes(template)) {
    return NextResponse.json(
      { error: `Invalid template. Valid: ${VALID_TEMPLATES.join(", ")}` },
      { status: 400 },
    );
  }

  const results: Record<string, "sent" | "error"> = {};

  async function send(name: string, subject: string, html: string) {
    try {
      await sendEmail(to!, subject, html);
      results[name] = "sent";
    } catch {
      results[name] = "error";
    }
  }

  const senders: Record<Exclude<Template, "all">, () => Promise<void>> = {
    welcome: async () => {
      const e = welcomeEmail("Test User", locale);
      await send("welcome", e.subject, e.html);
    },
    challenge_purchased: async () => {
      const e = challengePurchasedEmail(
        "Test User",
        "Pro",
        5000_00,
        15,
        locale,
      );
      await send("challenge_purchased", e.subject, e.html);
    },
    phase1_passed: async () => {
      const e = phase1PassedEmail("Test User", "Pro", 15, locale);
      await send("phase1_passed", e.subject, e.html);
    },
    funded: async () => {
      const e = fundedEmail("Test User", "Elite", 5000_00, 80, locale);
      await send("funded", e.subject, e.html);
    },
    drawdown_warning: async () => {
      const e = drawdownWarningEmail("Test User", "Pro", 8.5, locale);
      await send("drawdown_warning", e.subject, e.html);
    },
    challenge_failed: async () => {
      const e = challengeFailedEmail("Test User", "Pro", "drawdown", locale);
      await send("challenge_failed", e.subject, e.html);
    },
    payout_requested: async () => {
      const e = payoutRequestedEmail("Test User", 250_00, "USDT", locale);
      await send("payout_requested", e.subject, e.html);
    },
    payout_paid: async () => {
      const e = payoutPaidEmail(
        "Test User",
        250_00,
        "USDT",
        "TX-ABC123",
        locale,
      );
      await send("payout_paid", e.subject, e.html);
    },
    payout_rejected: async () => {
      const e = payoutRejectedEmail(
        "Test User",
        250_00,
        "KYC not complete",
        locale,
      );
      await send("payout_rejected", e.subject, e.html);
    },
    kyc_approved: async () => {
      const e = kycApprovedEmail("Test User", locale);
      await send("kyc_approved", e.subject, e.html);
    },
    kyc_rejected: async () => {
      const e = kycRejectedEmail("Test User", "ID document unclear", locale);
      await send("kyc_rejected", e.subject, e.html);
    },
    gift_voucher: async () => {
      const e = giftVoucherEmail(
        to!,
        "A Friend",
        "Pro",
        "TEST-GIFT-2024",
        locale,
      );
      await send("gift_voucher", e.subject, e.html);
    },
  };

  if (template === "all") {
    await Promise.all(Object.values(senders).map((fn) => fn()));
  } else {
    await senders[template]();
  }

  return NextResponse.json({ ok: true, to, locale, results });
}

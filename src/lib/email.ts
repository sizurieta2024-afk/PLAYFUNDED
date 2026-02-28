import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@playfunded.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://playfunded.com";

// ── Base HTML wrapper ────────────────────────────────────────────────────────
function wrap(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{margin:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e5e5}
  .wrap{max-width:560px;margin:32px auto;background:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden}
  .header{background:#16a34a;padding:24px 32px}
  .header h1{margin:0;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px}
  .header p{margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7)}
  .body{padding:28px 32px;line-height:1.6}
  .body h2{margin:0 0 12px;font-size:16px;font-weight:600;color:#f5f5f5}
  .body p{margin:0 0 16px;font-size:14px;color:#a3a3a3}
  .stat{display:inline-block;background:#1f1f1f;border:1px solid #2a2a2a;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
  .stat .val{font-size:20px;font-weight:700;color:#16a34a}
  .stat .lbl{font-size:11px;color:#737373;margin-top:2px}
  .btn{display:inline-block;margin:8px 0;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600}
  .footer{padding:16px 32px;border-top:1px solid #262626}
  .footer p{margin:0;font-size:11px;color:#525252;text-align:center}
  .tag{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}
  .tag-green{background:#16a34a22;color:#4ade80}
  .tag-red{background:#dc262622;color:#f87171}
  .tag-yellow{background:#ca8a0422;color:#fbbf24}
  hr{border:none;border-top:1px solid #262626;margin:20px 0}
</style></head><body>
<div class="wrap">${body}
<div class="footer"><p>PlayFunded · La plataforma de trading deportivo para América Latina<br/>
<a href="${APP_URL}/dashboard/settings" style="color:#525252">Manage notifications</a></p></div>
</div></body></html>`;
}

function header(title: string, sub?: string) {
  return `<div class="header"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`;
}

// ── Send helper ──────────────────────────────────────────────────────────────
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return; // silent no-op in dev without key
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[email] send failed:", to, subject, err);
    // Never throw — email failure must not break the main flow
  }
}

// ── 1. Welcome ───────────────────────────────────────────────────────────────
export function welcomeEmail(name: string | null): {
  subject: string;
  html: string;
} {
  const n = name ?? "there";
  return {
    subject: "Welcome to PlayFunded 🎯",
    html: wrap(`
      ${header("Welcome to PlayFunded", "We put the risk, you get the wins")}
      <div class="body">
        <h2>Hey ${n}, you're in!</h2>
        <p>PlayFunded is Latin America's sports trading platform. Prove your skill across two phases and earn a funded account — we put up the capital, you keep up to 80% of the profits.</p>
        <p>Here's how to get started:</p>
        <p>1️⃣ Browse our challenge tiers<br/>
           2️⃣ Purchase a challenge (entry fees start at $59)<br/>
           3️⃣ Hit the profit target in Phase 1 (+20%), then Phase 2 (+10%)<br/>
           4️⃣ Get funded and start earning real payouts</p>
        <a href="${APP_URL}/challenges" class="btn">Browse Challenges →</a>
        <hr/>
        <p>Questions? Just reply to this email or visit our <a href="${APP_URL}/faq" style="color:#16a34a">FAQ</a>.</p>
      </div>`),
  };
}

// ── 2. Challenge Purchased ───────────────────────────────────────────────────
export function challengePurchasedEmail(
  name: string | null,
  tierName: string,
  bankroll: number,
): { subject: string; html: string } {
  const n = name ?? "Trader";
  const bal = `$${(bankroll / 100).toLocaleString("en-US")}`;
  return {
    subject: `Challenge activated — ${tierName}`,
    html: wrap(`
      ${header("Your challenge is live!", `${tierName} · ${bal} bankroll`)}
      <div class="body">
        <h2>Good luck, ${n}.</h2>
        <p>Your <strong>${tierName}</strong> challenge has been activated with a <strong>${bal}</strong> simulated bankroll.</p>
        <div>
          <div class="stat"><div class="val">+20%</div><div class="lbl">Phase 1 target</div></div>
          <div class="stat"><div class="val">+10%</div><div class="lbl">Phase 2 target</div></div>
          <div class="stat"><div class="val">15</div><div class="lbl">Min picks</div></div>
          <div class="stat"><div class="val">−10%</div><div class="lbl">Daily loss limit</div></div>
        </div>
        <hr/>
        <a href="${APP_URL}/dashboard" class="btn">Go to Dashboard →</a>
      </div>`),
  };
}

// ── 3. Phase 1 Passed ────────────────────────────────────────────────────────
export function phase1PassedEmail(
  name: string | null,
  tierName: string,
): { subject: string; html: string } {
  const n = name ?? "Trader";
  return {
    subject: "Phase 1 passed — Phase 2 is starting 🚀",
    html: wrap(`
      ${header("Phase 1 complete!", "You're halfway to funded.")}
      <div class="body">
        <h2>Incredible work, ${n}!</h2>
        <p>You've passed <strong>Phase 1</strong> of your <strong>${tierName}</strong> challenge. Phase 2 has now started automatically.</p>
        <p><strong>Phase 2 target:</strong> reach +10% profit from your Phase 2 starting balance in a minimum of 15 picks.</p>
        <p>Keep the same discipline — watch your daily loss limit and drawdown. You're almost there.</p>
        <a href="${APP_URL}/dashboard" class="btn">Continue Trading →</a>
      </div>`),
  };
}

// ── 4. Funded ────────────────────────────────────────────────────────────────
export function fundedEmail(
  name: string | null,
  tierName: string,
  bankroll: number,
  splitPct: number,
): { subject: string; html: string } {
  const n = name ?? "Trader";
  const bal = `$${(bankroll / 100).toLocaleString("en-US")}`;
  return {
    subject: "You're FUNDED! 🏆",
    html: wrap(`
      ${header("Funded account activated!", `${tierName} · ${bal}`)}
      <div class="body">
        <h2>Congratulations, ${n}! You're officially funded.</h2>
        <p>You've demonstrated elite sports trading skill across both phases. Your <strong>${bal} funded account</strong> is now active.</p>
        <div>
          <div class="stat"><div class="val">${splitPct}%</div><div class="lbl">Your profit split</div></div>
          <div class="stat"><div class="val">${bal}</div><div class="lbl">Account size</div></div>
        </div>
        <hr/>
        <p>You can now request payouts once you have positive P&L. Complete KYC verification first to unlock withdrawals.</p>
        <a href="${APP_URL}/dashboard/payouts" class="btn">Request Payout →</a>
      </div>`),
  };
}

// ── 5. Challenge Failed ──────────────────────────────────────────────────────
export function challengeFailedEmail(
  name: string | null,
  tierName: string,
  reason: string,
): { subject: string; html: string } {
  const n = name ?? "Trader";
  return {
    subject: `Challenge ended — ${tierName}`,
    html: wrap(`
      ${header("Challenge ended", tierName)}
      <div class="body">
        <h2>Don't give up, ${n}.</h2>
        <p>Your <strong>${tierName}</strong> challenge has ended. <strong>Reason:</strong> ${reason}.</p>
        <p>The best traders learn from every trade. Review your picks in the analytics panel and identify patterns in your losses before retrying.</p>
        <a href="${APP_URL}/dashboard/analytics" class="btn">Review Analytics →</a>
        <hr/>
        <a href="${APP_URL}/challenges" style="color:#16a34a;font-size:13px">Try again →</a>
      </div>`),
  };
}

// ── 6. Payout Requested ──────────────────────────────────────────────────────
export function payoutRequestedEmail(
  name: string | null,
  amount: number,
  method: string,
): { subject: string; html: string } {
  const n = name ?? "Trader";
  const amt = `$${(amount / 100).toFixed(2)}`;
  return {
    subject: `Payout request received — ${amt}`,
    html: wrap(`
      ${header("Payout request received", amt)}
      <div class="body">
        <h2>We've received your payout request, ${n}.</h2>
        <div>
          <div class="stat"><div class="val">${amt}</div><div class="lbl">Amount</div></div>
          <div class="stat"><div class="val">${method}</div><div class="lbl">Method</div></div>
          <div class="stat"><div class="val">3–5 days</div><div class="lbl">Processing time</div></div>
        </div>
        <hr/>
        <p>Our team reviews all payout requests within 1 business day. You'll receive a confirmation email once your payout is processed.</p>
        <a href="${APP_URL}/dashboard/payouts" class="btn">Track Payout →</a>
      </div>`),
  };
}

// ── 7. Payout Paid ───────────────────────────────────────────────────────────
export function payoutPaidEmail(
  name: string | null,
  amount: number,
  method: string,
  txRef?: string | null,
): { subject: string; html: string } {
  const n = name ?? "Trader";
  const amt = `$${(amount / 100).toFixed(2)}`;
  return {
    subject: `Payout sent — ${amt} ✅`,
    html: wrap(`
      ${header("Payout sent!", amt)}
      <div class="body">
        <h2>Your money is on the way, ${n}!</h2>
        <p>We've processed your <strong>${amt}</strong> payout via <strong>${method}</strong>.</p>
        ${txRef ? `<p style="font-size:12px;color:#737373">Reference: <code style="background:#1f1f1f;padding:2px 6px;border-radius:4px">${txRef}</code></p>` : ""}
        <p>Allow 1–3 business days for the funds to arrive depending on your payment method.</p>
        <a href="${APP_URL}/dashboard/payouts" class="btn">View Payout History →</a>
      </div>`),
  };
}

// ── 8. Payout Rejected ───────────────────────────────────────────────────────
export function payoutRejectedEmail(
  name: string | null,
  amount: number,
  reason?: string | null,
): { subject: string; html: string } {
  const n = name ?? "Trader";
  const amt = `$${(amount / 100).toFixed(2)}`;
  return {
    subject: `Payout request update — ${amt}`,
    html: wrap(`
      ${header("Payout request update", amt)}
      <div class="body">
        <h2>Action required, ${n}.</h2>
        <p>Your payout request for <strong>${amt}</strong> could not be processed at this time.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>Please contact our support team so we can help resolve this. Your balance has not been affected.</p>
        <a href="mailto:${process.env.SUPPORT_EMAIL ?? "support@playfunded.com"}" class="btn">Contact Support →</a>
      </div>`),
  };
}

// ── 9. KYC Approved ─────────────────────────────────────────────────────────
export function kycApprovedEmail(name: string | null): {
  subject: string;
  html: string;
} {
  const n = name ?? "Trader";
  return {
    subject: "Identity verified ✅",
    html: wrap(`
      ${header("Identity verified!", "You can now request payouts")}
      <div class="body">
        <h2>Welcome to the verified club, ${n}!</h2>
        <p>Your identity has been successfully verified. You can now request payouts from your funded account.</p>
        <a href="${APP_URL}/dashboard/payouts" class="btn">Request Payout →</a>
      </div>`),
  };
}

// ── 10. KYC Rejected ────────────────────────────────────────────────────────
export function kycRejectedEmail(
  name: string | null,
  note?: string | null,
): { subject: string; html: string } {
  const n = name ?? "Trader";
  return {
    subject: "Identity verification update",
    html: wrap(`
      ${header("Identity verification update", "")}
      <div class="body">
        <h2>We need a little more from you, ${n}.</h2>
        <p>Your identity verification submission could not be approved at this time.</p>
        ${note ? `<p><strong>Reason:</strong> ${note}</p>` : ""}
        <p>Please resubmit with clearer documents. If you have any questions, contact our support team.</p>
        <a href="${APP_URL}/dashboard/payouts" class="btn">Resubmit KYC →</a>
      </div>`),
  };
}

// ── 11. Gift Voucher ─────────────────────────────────────────────────────────
export function giftVoucherEmail(
  recipientEmail: string,
  senderName: string | null,
  tierName: string,
  token: string,
): { subject: string; html: string } {
  const sender = senderName ?? "Someone";
  return {
    subject: `You received a PlayFunded challenge gift! 🎁`,
    html: wrap(`
      ${header("You've been gifted a challenge! 🎁", tierName)}
      <div class="body">
        <h2>${sender} gave you a PlayFunded challenge.</h2>
        <p>You've received a <strong>${tierName}</strong> challenge — a fully paid entry to prove your sports trading skills and earn a funded account.</p>
        <div class="stat"><div class="val" style="font-size:16px;letter-spacing:2px">${token}</div><div class="lbl">Your gift code</div></div>
        <hr/>
        <p>Create a free account and redeem your gift to activate your challenge. The code is single-use.</p>
        <a href="${APP_URL}/redeem/${token}" class="btn">Redeem Gift →</a>
      </div>`),
  };
}

// ── 12. Self-Exclusion ───────────────────────────────────────────────────────
export function selfExclusionEmail(
  name: string | null,
  period: string,
): { subject: string; html: string } {
  const n = name ?? "there";
  return {
    subject: "Self-exclusion activated",
    html: wrap(`
      ${header("Self-exclusion activated", period)}
      <div class="body">
        <h2>We've received your request, ${n}.</h2>
        <p>Your self-exclusion for <strong>${period}</strong> has been activated. You will not be able to purchase new challenges during this period.</p>
        <p>Your existing account, dashboard, and data remain intact.</p>
        <p>If you need support, please reach out to us anytime.</p>
        <a href="mailto:${process.env.SUPPORT_EMAIL ?? "support@playfunded.com"}" class="btn">Contact Support</a>
        <hr/>
        <p style="font-size:12px;color:#525252">If you did not request this, contact support immediately.</p>
      </div>`),
  };
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { PLATFORM_POLICY, getPayoutWindowLabel } from "@/lib/platform-policy";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are PlayFunded's support assistant.

ABOUT PLAYFUNDED:
- Users buy a challenge (entry fee) to prove their sports trading skill
- Challenges have 2 phases: Phase 1 (target: +20% profit) and Phase 2 (target: +20% profit)
- Rules: max ${PLATFORM_POLICY.risk.dailyLossLimitPct}% daily loss limit, max ${PLATFORM_POLICY.risk.drawdownLimitPct}% total drawdown
- Minimum ${PLATFORM_POLICY.risk.minPicksPerPhase} picks required per phase
- Once both phases are passed, the user gets a Funded account with a real simulated bankroll
- Commercial terms, payout methods, affiliate availability, and gift availability vary by country and compliance review
- If country approval is unclear, say it is subject to review and do not imply global availability

CHALLENGE TIERS (approximate):
- Starter: ~$19.99 fee, $500 simulated bankroll
- Pro: ~$46.99 fee, $1,500 simulated bankroll
- Elite: ~$129.99 fee, $4,500 simulated bankroll
- Master: ~$299.99 fee, $11,000 simulated bankroll
- Legend: ~$679.99 fee, $25,000 simulated bankroll

SPORTS & MARKETS:
- Sports: Soccer (Liga MX, Copa Libertadores, Premier League, etc.), Basketball (NBA), American Football (NFL), Tennis, MMA
- Market types: Moneyline (winner), Handicap (spread), Totals (over/under)
- Picks use decimal odds (e.g. 2.10 = $10 profit on $10 stake)
- Live betting is not allowed; picks close ${PLATFORM_POLICY.trading.eventLockMinutes} minutes before event start

PAYOUTS:
- Available once in the Funded phase with positive P&L
- KYC (identity verification) required before first payout
- All payouts are settled in ${PLATFORM_POLICY.payouts.settlementCurrency}
- Methods vary by country and compliance review
- Requests open monthly during ${getPayoutWindowLabel()}

KEY RULES:
- Max stake per pick: ${PLATFORM_POLICY.risk.maxStakePct}% of phase starting balance
- Daily loss resets every day at 00:00 UTC
- Drawdown is calculated from highest balance ever reached
- If drawdown or daily loss limits are breached, challenge fails
- Entry fees are ${PLATFORM_POLICY.commercial.entryFeesRefundable ? "refundable" : "non-refundable"}

AFFILIATE PROGRAM:
- Where enabled, users can join to earn ${PLATFORM_POLICY.commercial.affiliateBaseRatePct}% (or ${PLATFORM_POLICY.commercial.affiliateTopRatePct}% for top affiliates) commission on referrals
- Share a unique PF-XXXXXX referral link
- 30-day cookie tracking

Be helpful, concise, and friendly. Respond in the same language the user writes in (Spanish, Portuguese, or English). If you don't know something specific, say so honestly and suggest contacting support. Don't make up rules or numbers not listed above.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const limit = enforceRateLimit(req, "api:chat", {
    windowMs: 60_000,
    max: 20,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse(
      "Too many chat requests. Please wait and try again.",
      limit,
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Chat not configured" }, { status: 500 });
  }

  let messages: Message[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Cap to last 10 messages to limit token usage
  const trimmed = messages.slice(-10);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: trimmed,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ message: text });
  } catch (err) {
    console.error("[chat] Anthropic error:", err);
    return NextResponse.json({ error: "Chat unavailable" }, { status: 500 });
  }
}

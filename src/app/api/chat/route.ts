import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are PlayFunded's support assistant. PlayFunded is a sports prop trading firm platform for Latin America.

ABOUT PLAYFUNDED:
- Users buy a challenge (entry fee) to prove their sports trading skill
- Challenges have 2 phases: Phase 1 (target: +20% profit) and Phase 2 (target: +10% profit)
- Rules: max 10% daily loss limit, max 15% total drawdown
- Minimum 15 picks required per phase
- Once both phases are passed, the user gets a Funded account with a real simulated bankroll
- Funded traders earn 70-80% of their profits as payouts (profit split)

CHALLENGE TIERS (approximate):
- Starter $1K: ~$59 fee, $1,000 simulated bankroll
- Pro $5K: ~$149 fee, $5,000 simulated bankroll
- Elite $10K: ~$249 fee, $10,000 simulated bankroll
- Master $25K: ~$499 fee, $25,000 simulated bankroll

SPORTS & MARKETS:
- Sports: Soccer (Liga MX, Copa Libertadores, Premier League, etc.), Basketball (NBA), American Football (NFL), Tennis, MMA
- Market types: Moneyline (winner), Handicap (spread), Totals (over/under)
- Picks use decimal odds (e.g. 2.10 = $10 profit on $10 stake)

PAYOUTS:
- Available once in the Funded phase with positive P&L
- KYC (identity verification) required before first payout
- Methods: bank wire, USDT, USDC, Bitcoin, PayPal
- Processing: 3-5 business days

KEY RULES:
- Max stake per pick: 5% of current balance
- Daily loss resets every day at 00:00 UTC
- Drawdown is calculated from highest balance ever reached
- If drawdown or daily loss limits are breached, challenge fails

AFFILIATE PROGRAM:
- Users can join to earn 5% (or 10% for top affiliates) commission on referrals
- Share a unique PF-XXXXXX referral link
- 30-day cookie tracking

Be helpful, concise, and friendly. Respond in the same language the user writes in (Spanish or English). If you don't know something specific, say so honestly and suggest contacting support. Don't make up rules or numbers not listed above.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
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

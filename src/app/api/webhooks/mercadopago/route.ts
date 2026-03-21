import { NextResponse } from "next/server";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { recordOpsEvent } from "@/lib/ops-events";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const limit = await enforceRateLimit(request, "api:webhooks:mercadopago", {
    windowMs: 60_000,
    max: 240,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse("Too many webhook calls", limit);
  }

  await recordOpsEvent({
    type: "webhook_handler_failed",
    level: "warn",
    source: "api:webhooks:mercadopago",
    subjectType: "provider",
    subjectId: "mercadopago",
    details: {
      provider: "mercadopago",
      code: "PAYMENT_METHOD_DISABLED",
      reason: "Mercado Pago webhook received after provider was disabled.",
    },
  });

  return NextResponse.json(
    {
      error: "Mercado Pago is disabled for launch.",
      code: "PAYMENT_METHOD_DISABLED",
    },
    { status: 410 },
  );
}

import { NextResponse } from "next/server";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { recordOpsEvent } from "@/lib/ops-events";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const limit = await enforceRateLimit(request, "api:checkout:mercadopago", {
    windowMs: 60_000,
    max: 12,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse(
      "Too many checkout attempts. Please wait and try again.",
      limit,
    );
  }

  await recordOpsEvent({
    type: "checkout_create_failed",
    level: "warn",
    source: "api:checkout:mercadopago",
    subjectType: "provider",
    subjectId: "mercadopago",
    details: {
      provider: "mercadopago",
      code: "PAYMENT_METHOD_DISABLED",
      reason: "Mercado Pago has been disabled for launch.",
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

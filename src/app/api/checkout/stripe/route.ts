import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { resolveCountry, type CheckoutMethod } from "@/lib/country-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { recordOpsEvent } from "@/lib/ops-events";
import { withRouteMetric } from "@/lib/ops-observability";
import { PLATFORM_POLICY } from "@/lib/platform-policy";
import { resolveAffiliateDiscountCode } from "@/lib/affiliate/codes";
import { z } from "zod";

const bodySchema = z.object({
  tierId: z.string().uuid(),
  locale: z.string().min(2).max(10),
  isGift: z.boolean().optional(),
  giftRecipientEmail: z.string().email().optional(),
  country: z.string().length(2).optional(), // ISO 3166-1 alpha-2 country code
  paymentMethod: z.enum(["card", "pix"]).optional(),
  discountCode: z.string().min(2).max(32).optional(),
});

export async function POST(req: NextRequest) {
  return withRouteMetric(
    {
      route: "POST /api/checkout/stripe",
      source: "api:checkout:stripe",
    },
    async () => {
      const limit = await enforceRateLimit(req, "api:checkout:stripe", {
        windowMs: 60_000,
        max: 12,
      });
      if (!limit.allowed) {
        return rateLimitExceededResponse(
          "Too many checkout attempts. Please wait and try again.",
          limit,
        );
      }

      // Auth required — must be logged in to purchase
      const supabase = await createServerClient();
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        return NextResponse.json(
          { error: "Unauthorized", code: "AUTH_REQUIRED" },
          { status: 401 },
        );
      }

      let body: z.infer<typeof bodySchema>;
      try {
        body = bodySchema.parse(await req.json());
      } catch {
        return NextResponse.json(
          { error: "Invalid request body", code: "INVALID_BODY" },
          { status: 400 },
        );
      }

      const {
        tierId,
        locale,
        isGift,
        giftRecipientEmail,
        country,
        discountCode,
      } = body;
      const paymentMethod: CheckoutMethod = body.paymentMethod ?? "card";
      const headerCountry = resolveCountry(
        req.headers.get("x-vercel-ip-country"),
        req.headers.get("cf-ipcountry"),
      );

      const tier = await prisma.tier.findUnique({ where: { id: tierId } });
      if (!tier || !tier.isActive) {
        return NextResponse.json(
          { error: "Tier not found or inactive", code: "TIER_NOT_FOUND" },
          { status: 404 },
        );
      }

      const user = await prisma.user.findUnique({
        where: { supabaseId: authUser.id },
        select: {
          id: true,
          email: true,
          country: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: "User not found", code: "USER_NOT_FOUND" },
          { status: 404 },
        );
      }

      if (isGift && paymentMethod !== "card") {
        return NextResponse.json(
          {
            error: "Gift purchases are only available with card checkout.",
            code: "GIFT_METHOD_UNAVAILABLE",
          },
          { status: 400 },
        );
      }

      try {
        const checkoutCountry = resolveCountry(
          country,
          headerCountry,
          user.country,
        );
        const policy = await getResolvedCountryPolicy(checkoutCountry);
        if (!policy.challengePurchasesEnabled) {
          return NextResponse.json(
            {
              error:
                "Challenge purchases are not available in your country right now.",
              code: "COUNTRY_NOT_AVAILABLE",
            },
            { status: 403 },
          );
        }

        if (!policy.checkoutMethods.includes(paymentMethod)) {
          return NextResponse.json(
            {
              error:
                "This payment method is not available in your country right now.",
              code: "PAYMENT_METHOD_UNAVAILABLE",
            },
            { status: 403 },
          );
        }

        if (isGift && !policy.marketing.giftsEnabled) {
          return NextResponse.json(
            {
              error:
                "Gift purchases are not available in your country right now.",
              code: "GIFT_NOT_AVAILABLE",
            },
            { status: 403 },
          );
        }

        const discount = await resolveAffiliateDiscountCode(
          prisma,
          tier.fee,
          discountCode,
        );
        if (discountCode && !discount) {
          return NextResponse.json(
            {
              error: "Discount code is invalid or inactive.",
              code: "INVALID_DISCOUNT_CODE",
            },
            { status: 400 },
          );
        }
        if (discount && discount.affiliate.userId === user.id) {
          return NextResponse.json(
            {
              error: "You cannot use your own partner code.",
              code: "OWN_DISCOUNT_CODE",
            },
            { status: 400 },
          );
        }

        const checkoutUrl = await createCheckoutSession({
          tierId: tier.id,
          tierName: tier.name,
          feeInCents: discount?.discountedAmount ?? tier.fee,
          userId: user.id,
          userEmail: user.email,
          locale,
          isGift,
          giftRecipientEmail,
          enablePix: paymentMethod === "pix",
          country: checkoutCountry ?? undefined,
          policyVersion: PLATFORM_POLICY.policyVersion,
          paymentMethodKind: paymentMethod,
          affiliateCode: discount?.affiliate.code ?? null,
          listPriceAmount: tier.fee,
          discountAmount: discount?.discountAmount ?? 0,
          discountPct: discount?.affiliate.discountPct ?? 0,
        });
        await recordOpsEvent({
          type: "checkout_created",
          source: "api:checkout:stripe",
          actorUserId: user.id,
          subjectType: "tier",
          subjectId: tier.id,
          country: checkoutCountry,
          details: {
            provider: "stripe",
            userId: user.id,
            tierId: tier.id,
            paymentMethod,
            checkoutCountry,
            isGift: Boolean(isGift),
            discountCode: discount?.affiliate.code ?? null,
            discountAmount: discount?.discountAmount ?? 0,
          },
        });
        return NextResponse.json({ url: checkoutUrl });
      } catch (err) {
        console.error("[checkout/stripe] error:", err);
        await recordOpsEvent({
          type: "checkout_create_failed",
          level: "error",
          source: "api:checkout:stripe",
          actorUserId: user.id,
          subjectType: "tier",
          subjectId: tierId,
          details: {
            provider: "stripe",
            tierId,
            paymentMethod,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        return NextResponse.json(
          { error: "Failed to create checkout session", code: "STRIPE_ERROR" },
          { status: 500 },
        );
      }
    },
  );
}

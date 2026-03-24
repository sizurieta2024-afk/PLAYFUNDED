import Stripe from "stripe";
import { fetchWithTimeout } from "@/lib/net/fetch-with-timeout";

function getStripeSecretKey(): string {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return process.env.STRIPE_SECRET_KEY;
}

function getStripeClient(): Stripe {
  return new Stripe(getStripeSecretKey(), {
    apiVersion: "2026-01-28.clover",
    typescript: true,
  });
}

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) _stripe = getStripeClient();
  return _stripe;
}

export const stripe = {
  webhooks: {
    constructEvent: (
      body: string,
      sig: string,
      secret: string,
    ): Stripe.Event => {
      return getStripe().webhooks.constructEvent(body, sig, secret);
    },
  },
};

function buildStripeCheckoutForm(input: {
  currency: string;
  unitAmount: number;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  productName: string;
  productDescription: string;
  enablePix: boolean;
}) {
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("customer_email", input.userEmail);
  form.set("line_items[0][price_data][currency]", input.currency);
  form.set("line_items[0][price_data][unit_amount]", String(input.unitAmount));
  form.set("line_items[0][price_data][product_data][name]", input.productName);
  form.set(
    "line_items[0][price_data][product_data][description]",
    input.productDescription,
  );
  form.set("line_items[0][quantity]", "1");
  form.set("billing_address_collection", "auto");
  form.set("success_url", input.successUrl);
  form.set("cancel_url", input.cancelUrl);

  if (input.enablePix) {
    form.set("payment_method_types[0]", "pix");
    form.set("payment_method_options[pix][expires_after_seconds]", "3600");
  }

  for (const [key, value] of Object.entries(input.metadata)) {
    form.set(`metadata[${key}]`, value);
  }

  return form;
}

function shouldFallbackToStripeRest(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /connection to stripe/i.test(message) ||
    /ECONN/i.test(message) ||
    /ETIMEDOUT/i.test(message) ||
    /fetch failed/i.test(message)
  );
}

async function createCheckoutSessionViaRest(input: {
  currency: string;
  unitAmount: number;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  productName: string;
  productDescription: string;
  enablePix: boolean;
}) {
  const body = buildStripeCheckoutForm(input);
  const response = await fetchWithTimeout(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getStripeSecretKey()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
    10_000,
  );

  const payload = (await response.json()) as {
    error?: { message?: string };
    url?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message ??
        `Stripe REST fallback failed with ${response.status}`,
    );
  }

  if (!payload.url) {
    throw new Error("Stripe REST fallback did not return a checkout URL");
  }

  return payload.url;
}

interface CreateCheckoutSessionParams {
  tierId: string;
  tierName: string;
  feeInCents: number;
  userId: string;
  userEmail: string;
  locale: string;
  isGift?: boolean;
  giftRecipientEmail?: string;
  enablePix?: boolean; // true for Brazil users — charges in BRL via Pix
  country?: string;
  policyVersion?: string;
  paymentMethodKind?: "card" | "pix";
  affiliateCode?: string | null;
  listPriceAmount?: number;
  discountAmount?: number;
  discountPct?: number;
}

export async function createCheckoutSession({
  tierId,
  tierName,
  feeInCents,
  userId,
  userEmail,
  locale,
  isGift = false,
  giftRecipientEmail,
  enablePix = false,
  country,
  policyVersion,
  paymentMethodKind = "card",
  affiliateCode,
  listPriceAmount,
  discountAmount = 0,
  discountPct = 0,
}: CreateCheckoutSessionParams): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const localePath =
    locale === "en" ? "/en" : locale === "pt-BR" ? "/pt-BR" : "";

  // Pix requires BRL currency. Fetch exchange rate and convert.
  let currency = "usd";
  let unitAmount = feeInCents;
  if (enablePix) {
    try {
      const rateRes = await fetch("https://open.er-api.com/v6/latest/USD", {
        next: { revalidate: 3600 },
      });
      if (rateRes.ok) {
        const rateData = (await rateRes.json()) as {
          rates: Record<string, number>;
        };
        const brlRate = rateData.rates["BRL"] ?? 5.0;
        currency = "brl";
        unitAmount = Math.round((feeInCents / 100) * brlRate * 100);
      }
    } catch {
      // Fall back to USD if rate fetch fails
    }
  }

  // Pass Stripe fee to the user so we always net the full tier price.
  // Card (LATAM/international): 3.9% + $0.30 fixed → gross up so after fee we net feeInCents.
  // Pix (BRL): 1.99% flat, no fixed fee.
  // Formula: grossAmount = ceil((amount + fixedFee) / (1 - pctFee))
  if (enablePix) {
    unitAmount = Math.ceil(unitAmount / (1 - 0.0199));
  } else {
    unitAmount = Math.ceil((unitAmount + 30) / (1 - 0.039));
  }

  const productDescription = (() => {
    if (locale === "en") {
      return isGift
        ? `Sports trading challenge gift for ${giftRecipientEmail ?? "recipient"}.`
        : "Sports trading challenge — prove your skill, get funded.";
    }
    if (locale === "pt-BR") {
      return isGift
        ? `Presente de desafio de trading esportivo para ${giftRecipientEmail ?? "destinatário"}.`
        : "Desafio de trading esportivo — demonstre seu talento, seja financiado.";
    }
    return isGift
      ? `Regalo de desafío de trading deportivo para ${giftRecipientEmail ?? "destinatario"}.`
      : "Desafío de trading deportivo — demuestra tu talento, obtén financiamiento.";
  })();

  const sessionInput = {
    currency,
    unitAmount,
    userEmail,
    successUrl: `${baseUrl}${localePath}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}${localePath}/checkout/cancel`,
    metadata: {
      tierId,
      userId,
      isGift: isGift ? "true" : "false",
      giftRecipientEmail: giftRecipientEmail ?? "",
      country: country ?? "",
      policyVersion: policyVersion ?? "",
      paymentMethodKind,
      affiliateCode: affiliateCode ?? "",
      listPriceAmount: String(listPriceAmount ?? feeInCents),
      discountAmount: String(discountAmount),
      discountPct: String(discountPct),
    },
    productName: isGift
      ? `PlayFunded — ${tierName} (Gift)`
      : `PlayFunded — ${tierName}`,
    productDescription,
    enablePix,
  };

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: userEmail,
      ...(enablePix ? { payment_method_types: ["pix"] as ["pix"] } : {}),
      ...(enablePix
        ? { payment_method_options: { pix: { expires_after_seconds: 3600 } } }
        : {}),
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: sessionInput.productName,
              description: productDescription,
            },
          },
          quantity: 1,
        },
      ],
      metadata: sessionInput.metadata,
      success_url: sessionInput.successUrl,
      cancel_url: sessionInput.cancelUrl,
      billing_address_collection: "auto",
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return session.url;
  } catch (error) {
    if (!shouldFallbackToStripeRest(error)) {
      throw error;
    }
    return createCheckoutSessionViaRest(sessionInput);
  }
}

import Stripe from "stripe";

function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
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
            name: isGift
              ? `PlayFunded — ${tierName} (Gift)`
              : `PlayFunded — ${tierName}`,
            description: productDescription,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      tierId,
      userId,
      isGift: isGift ? "true" : "false",
      giftRecipientEmail: giftRecipientEmail ?? "",
      country: country ?? "",
      policyVersion: policyVersion ?? "",
    },
    success_url: `${baseUrl}${localePath}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}${localePath}/checkout/cancel`,
    billing_address_collection: "auto",
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}

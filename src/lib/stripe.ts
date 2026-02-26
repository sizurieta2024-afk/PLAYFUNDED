import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});

interface CreateCheckoutSessionParams {
  tierId: string;
  tierName: string;
  feeInCents: number; // USD cents
  userId: string;
  userEmail: string;
  locale: string;
}

export async function createCheckoutSession({
  tierId,
  tierName,
  feeInCents,
  userId,
  userEmail,
  locale,
}: CreateCheckoutSessionParams): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const localePath = locale === "en" ? "/en" : "";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: feeInCents,
          product_data: {
            name: `PlayFunded — ${tierName}`,
            description:
              locale === "en"
                ? "Sports trading challenge — prove your skill, get funded."
                : "Desafío de trading deportivo — demuestra tu talento, obtén financiamiento.",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      tierId,
      userId,
    },
    success_url: `${baseUrl}${localePath}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}${localePath}/checkout/cancel`,
    // Collect billing address for tax purposes (optional but recommended)
    billing_address_collection: "auto",
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}

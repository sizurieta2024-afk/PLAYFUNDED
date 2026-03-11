import { MercadoPagoConfig, Preference } from "mercadopago";

function getMpClient(): MercadoPagoConfig {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN not set");
  return new MercadoPagoConfig({ accessToken: token });
}

interface CreateMpPreferenceParams {
  tierId: string;
  tierName: string;
  feeInCents: number; // USD cents
  userId: string;
  userEmail: string;
  locale: string;
  country?: string;
  policyVersion?: string;
}

export async function createMpPreference({
  tierId,
  tierName,
  feeInCents,
  userId,
  userEmail,
  locale,
  country,
  policyVersion,
}: CreateMpPreferenceParams): Promise<string> {
  const client = getMpClient();
  const preference = new Preference(client);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const localePath = locale === "es-419" ? "" : `/${locale}`;
  const notificationUrl = webhookSecret
    ? `${baseUrl}/api/webhooks/mercadopago?token=${encodeURIComponent(webhookSecret)}`
    : `${baseUrl}/api/webhooks/mercadopago`;

  const result = await preference.create({
    body: {
      items: [
        {
          id: tierId,
          title: `PlayFunded — ${tierName}`,
          description: "Sports trading challenge — prove your skill, get funded.",
          quantity: 1,
          unit_price: feeInCents / 100, // MP uses decimal, not cents
          currency_id: "USD",
        },
      ],
      payer: { email: userEmail },
      metadata: {
        tier_id: tierId,
        user_id: userId,
        country: country ?? "",
        policyVersion: policyVersion ?? "",
      },
      back_urls: {
        success: `${baseUrl}${localePath}/checkout/success`,
        failure: `${baseUrl}${localePath}/checkout/cancel`,
        pending: `${baseUrl}${localePath}/checkout/pending`,
      },
      auto_return: "approved",
      notification_url: notificationUrl,
    },
  });

  const url = result.init_point;
  if (!url) throw new Error("Mercado Pago did not return a checkout URL");
  return url;
}

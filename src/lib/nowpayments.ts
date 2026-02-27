const BASE_URL = "https://api.nowpayments.io/v1";

function getApiKey(): string {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) throw new Error("NOWPAYMENTS_API_KEY not set");
  return key;
}

export type CryptoCurrency = "usdttrc20" | "usdcerc20" | "btc";

export interface CryptoInvoice {
  paymentId: string;
  address: string;
  amount: number;
  currency: CryptoCurrency;
  network: string;
  expiresAt: Date;
}

interface CreateInvoiceParams {
  tierId: string;
  tierName: string;
  feeInCents: number;
  userId: string;
  userEmail: string;
  currency: CryptoCurrency;
  locale: string;
}

export async function createCryptoInvoice({
  tierId,
  tierName,
  feeInCents,
  userId,
  currency,
  locale,
}: CreateInvoiceParams): Promise<CryptoInvoice> {
  const apiKey = getApiKey();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const localePath = locale === "es-419" ? "" : `/${locale}`;

  const res = await fetch(`${BASE_URL}/payment`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: feeInCents / 100,
      price_currency: "usd",
      pay_currency: currency,
      order_id: `${tierId}:${userId}:${Date.now()}`,
      order_description: `PlayFunded — ${tierName}`,
      ipn_callback_url: `${baseUrl}/api/webhooks/nowpayments`,
      success_url: `${baseUrl}${localePath}/checkout/success`,
      cancel_url: `${baseUrl}${localePath}/checkout/cancel`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NOWPayments error: ${err}`);
  }

  const data = (await res.json()) as {
    payment_id: string;
    pay_address: string;
    pay_amount: number;
    pay_currency: string;
    network: string;
  };

  // NOWPayments invoices expire in 20 minutes by default
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

  return {
    paymentId: data.payment_id,
    address: data.pay_address,
    amount: data.pay_amount,
    currency: currency,
    network: data.network,
    expiresAt,
  };
}

// Verify IPN signature: HMAC-SHA512 of sorted JSON body
export async function verifyNowPaymentsSignature(
  body: string,
  signature: string
): Promise<boolean> {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return false;

  const encoder = new TextEncoder();

  // NOWPayments signs the JSON body with keys sorted alphabetically
  const parsed = JSON.parse(body) as Record<string, unknown>;
  const sorted = Object.keys(parsed)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => { acc[k] = parsed[k]; return acc; }, {});
  const sortedBody = JSON.stringify(sorted);

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );

  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(sortedBody));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hex === signature;
}

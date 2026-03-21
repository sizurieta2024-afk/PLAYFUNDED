import { fetchWithTimeout } from "../net/fetch-with-timeout";

const BASE_URL = "https://api.nowpayments.io/v1";

export interface NowPaymentsPayoutExecutionInput {
  address: string;
  currency: "btc" | "usdt" | "usdc";
  amountCents: number;
}

export interface NowPaymentsPayoutExecutionResult {
  payoutId: string;
  status: string;
  hash: string | null;
  raw: unknown;
}

export interface NowPaymentsPayoutStatusResult {
  payoutId: string;
  status: string;
  hash: string | null;
  raw: unknown;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function asJsonError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  if ("errors" in payload && Array.isArray(payload.errors)) {
    return payload.errors.join(", ");
  }
  return null;
}

async function getAuthToken() {
  const email = process.env.NOWPAYMENTS_PAYOUT_EMAIL;
  const password = process.env.NOWPAYMENTS_PAYOUT_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "NOWPAYMENTS_PAYOUT_EMAIL and NOWPAYMENTS_PAYOUT_PASSWORD are required for crypto payout execution",
    );
  }

  const response = await fetchWithTimeout(
    `${BASE_URL}/auth`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
    10_000,
  );

  const payload = (await response.json()) as { token?: string; message?: string };
  if (!response.ok || !payload.token) {
    throw new Error(
      asJsonError(payload) ?? `NOWPayments auth failed with ${response.status}`,
    );
  }

  return payload.token;
}

function normalizePayoutCurrency(currency: "btc" | "usdt" | "usdc") {
  if (currency === "usdt") return "usdttrc20";
  if (currency === "usdc") return "usdcerc20";
  return "btc";
}

function centsToCryptoAmount(currency: "btc" | "usdt" | "usdc", amountCents: number) {
  // NOWPayments payout API expects crypto-denominated amounts. For launch,
  // we keep payout records in USD cents and rely on custody balances in
  // stablecoins or BTC-equivalent handled operationally.
  if (currency === "usdt" || currency === "usdc") {
    return Number((amountCents / 100).toFixed(6));
  }
  return Number((amountCents / 100).toFixed(6));
}

function mapWithdrawal(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("NOWPayments payout response did not include a withdrawal");
  }
  const withdrawal = Array.isArray((payload as { withdrawals?: unknown[] }).withdrawals)
    ? (payload as { withdrawals: Array<Record<string, unknown>> }).withdrawals[0]
    : null;
  if (!withdrawal) {
    throw new Error("NOWPayments payout response did not include withdrawals");
  }

  return {
    status: String(withdrawal.status ?? "unknown"),
    hash:
      typeof withdrawal.hash === "string" && withdrawal.hash.trim()
        ? withdrawal.hash
        : null,
  };
}

export async function executeNowPaymentsCryptoPayout(
  input: NowPaymentsPayoutExecutionInput,
): Promise<NowPaymentsPayoutExecutionResult> {
  const token = await getAuthToken();
  const apiKey = getRequiredEnv("NOWPAYMENTS_API_KEY");
  const response = await fetchWithTimeout(
    `${BASE_URL}/payout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        withdrawals: [
          {
            address: input.address,
            currency: normalizePayoutCurrency(input.currency),
            amount: centsToCryptoAmount(input.currency, input.amountCents),
          },
        ],
      }),
    },
    10_000,
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      asJsonError(payload) ??
        `NOWPayments payout create failed with ${response.status}`,
    );
  }

  const payoutId =
    payload && typeof payload === "object" && "id" in payload
      ? String(payload.id)
      : null;
  if (!payoutId) {
    throw new Error("NOWPayments payout response did not include an id");
  }

  const withdrawal = mapWithdrawal(payload);

  return {
    payoutId,
    status: withdrawal.status,
    hash: withdrawal.hash,
    raw: payload,
  };
}

export async function getNowPaymentsPayoutStatus(
  payoutId: string,
): Promise<NowPaymentsPayoutStatusResult> {
  const apiKey = getRequiredEnv("NOWPAYMENTS_API_KEY");
  const response = await fetchWithTimeout(
    `${BASE_URL}/payout/${payoutId}`,
    {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    },
    10_000,
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      asJsonError(payload) ??
        `NOWPayments payout status failed with ${response.status}`,
    );
  }

  const withdrawal = mapWithdrawal(payload);
  return {
    payoutId,
    status: withdrawal.status,
    hash: withdrawal.hash,
    raw: payload,
  };
}

export function mapNowPaymentsPayoutStatus(status: string): "processing" | "paid" | "failed" {
  const normalized = status.trim().toLowerCase();
  if (
    [
      "finished",
      "success",
      "successful",
      "sent",
      "completed",
      "confirmed",
    ].includes(normalized)
  ) {
    return "paid";
  }
  if (
    [
      "failed",
      "error",
      "expired",
      "cancelled",
      "canceled",
      "rejected",
    ].includes(normalized)
  ) {
    return "failed";
  }
  return "processing";
}

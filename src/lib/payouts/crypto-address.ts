import type { PayoutMethod } from "@prisma/client";

const BTC_RE =
  /^(?:bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
const ETH_RE = /^0x[a-fA-F0-9]{40}$/;
const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export function requiresCryptoDestination(method: PayoutMethod): boolean {
  return method === "btc" || method === "usdt" || method === "usdc";
}

export function validateCryptoDestination(
  method: PayoutMethod,
  address?: string | null,
): { ok: true; normalized: string } | { ok: false; error: string } {
  const normalized = address?.trim() ?? "";
  if (!requiresCryptoDestination(method)) {
    return { ok: true, normalized: "" };
  }

  if (!normalized) {
    return { ok: false, error: "destination_required" };
  }

  if (method === "btc" && !BTC_RE.test(normalized)) {
    return { ok: false, error: "invalid_btc_address" };
  }

  if (method === "usdc" && !ETH_RE.test(normalized)) {
    return { ok: false, error: "invalid_usdc_address" };
  }

  if (method === "usdt" && !TRON_RE.test(normalized)) {
    return { ok: false, error: "invalid_usdt_address" };
  }

  return { ok: true, normalized };
}


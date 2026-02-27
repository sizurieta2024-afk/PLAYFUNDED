// Exchange rates cache — refreshed once per hour
// Maps LATAM locale/country hints to their primary currency
export const LATAM_CURRENCIES: Record<string, { code: string; symbol: string; name: string }> = {
  ARS: { code: "ARS", symbol: "$", name: "Argentine peso" },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian real" },
  MXN: { code: "MXN", symbol: "$", name: "Mexican peso" },
  COP: { code: "COP", symbol: "$", name: "Colombian peso" },
  CLP: { code: "CLP", symbol: "$", name: "Chilean peso" },
  PEN: { code: "PEN", symbol: "S/", name: "Peruvian sol" },
};

interface RateCache {
  rates: Record<string, number>; // USD → other currency
  fetchedAt: number;
}

let _cache: RateCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getUsdRates(): Promise<Record<string, number>> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.rates;
  }

  const apiKey = process.env.EXCHANGERATE_API_KEY;

  try {
    const url = apiKey
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
      : "https://open.er-api.com/v6/latest/USD"; // free fallback, no key needed

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error("Exchange rate fetch failed");

    const data = (await res.json()) as { rates: Record<string, number> };
    _cache = { rates: data.rates, fetchedAt: Date.now() };
    return data.rates;
  } catch {
    // Return stale cache or empty on failure — don't crash the page
    return _cache?.rates ?? {};
  }
}

/**
 * Format a USD cents amount in a LATAM currency.
 * Returns null if rate unavailable.
 */
export async function formatLocalPrice(
  usdCents: number,
  currencyCode: string
): Promise<string | null> {
  const rates = await getUsdRates();
  const rate = rates[currencyCode];
  if (!rate) return null;

  const localAmount = (usdCents / 100) * rate;
  const meta = LATAM_CURRENCIES[currencyCode];

  return new Intl.NumberFormat("es-419", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(localAmount) + (meta ? ` ${meta.code}` : "");
}

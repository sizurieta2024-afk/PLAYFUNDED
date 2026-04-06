// Exchange rates cache — refreshed once per hour
// Maps supported currencies and country → currency defaults.
import { fetchExternalJson } from "@/lib/net/external-read";

export const LATAM_CURRENCIES: Record<
  string,
  { code: string; symbol: string; name: string }
> = {
  ARS: { code: "ARS", symbol: "$", name: "Argentine peso" },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian real" },
  MXN: { code: "MXN", symbol: "$", name: "Mexican peso" },
  COP: { code: "COP", symbol: "$", name: "Colombian peso" },
  CLP: { code: "CLP", symbol: "$", name: "Chilean peso" },
  PEN: { code: "PEN", symbol: "S/", name: "Peruvian sol" },
  EUR: { code: "EUR", symbol: "€", name: "Euro" },
  GBP: { code: "GBP", symbol: "£", name: "British pound" },
};

export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  AR: "ARS",
  BR: "BRL",
  MX: "MXN",
  CO: "COP",
  CL: "CLP",
  PE: "PEN",
  ES: "EUR",
  GB: "GBP",
  UK: "GBP",
};

const FALLBACK_USD_RATES: Record<string, number> = {
  ARS: 1060,
  BRL: 5.0,
  MXN: 17.0,
  COP: 4000,
  CLP: 950,
  PEN: 3.75,
  EUR: 0.92,
  GBP: 0.79,
};

const CURRENCY_TO_LOCALE: Record<string, string> = {
  EUR: "es-ES",
  GBP: "en-GB",
  BRL: "pt-BR",
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

    const { data } = await fetchExternalJson<{ rates: Record<string, number> }>({
      provider: apiKey ? "exchangerate_api" : "open_er_api",
      operation: "usd_rates",
      url,
      init: { next: { revalidate: 3600 } },
      retries: 1,
      recordOps: false,
    });
    const mergedRates = { ...FALLBACK_USD_RATES, ...data.rates };
    _cache = { rates: mergedRates, fetchedAt: Date.now() };
    return mergedRates;
  } catch {
    // Return stale cache or empty on failure — don't crash the page
    return _cache?.rates ?? FALLBACK_USD_RATES;
  }
}

/**
 * Format a USD cents amount in a LATAM currency.
 * Returns null if rate unavailable.
 */
export async function formatLocalPrice(
  usdCents: number,
  currencyCode: string,
): Promise<string | null> {
  const rates = await getUsdRates();
  const rate = rates[currencyCode];
  if (!rate) return null;

  const localAmount = (usdCents / 100) * rate;
  const meta = LATAM_CURRENCIES[currencyCode];
  const locale = CURRENCY_TO_LOCALE[currencyCode] ?? "es-419";
  const showDecimals = currencyCode === "EUR" || currencyCode === "GBP";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(localAmount) + (meta ? ` ${meta.code}` : "");
}

export function getCurrencyForCountry(country?: string): string | null {
  if (!country) return null;
  return COUNTRY_TO_CURRENCY[country.toUpperCase()] ?? null;
}

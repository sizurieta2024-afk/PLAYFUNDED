import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { connectPrismaWithRetry } from "./lib/prisma-smoke.mjs";

const baseUrl = process.env.BASE_URL ?? "https://playfunded.lat";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase env vars are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isSecureBaseUrl = new URL(baseUrl).protocol === "https:";
const stamp = Date.now();
const createdAuthUserIds = [];
const createdUserIds = [];
const createdPaymentIds = [];
let prisma;

async function createAuthUser(label) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const email = `${slug}+${stamp}@playfunded.local`;
  const password = "PlayfundedPayment!123";
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  if (error) throw error;
  createdAuthUserIds.push(data.user.id);
  return { email, password, supabaseId: data.user.id };
}

async function createAppUser({ email, supabaseId, name, country }) {
  const user = await prisma.user.create({
    data: {
      email,
      supabaseId,
      name,
      country,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function loginCookie(email, password) {
  const loginResponse = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ email, password }),
    },
  );
  if (!loginResponse.ok) {
    throw new Error(
      `Supabase login failed: ${loginResponse.status} ${await loginResponse.text()}`,
    );
  }

  const session = await loginResponse.json();
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${ref}-auth-token`;
  const cookieValue =
    "base64-" +
    Buffer.from(
      JSON.stringify({
        access_token: session.access_token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: session.expires_at,
        refresh_token: session.refresh_token,
        user: session.user,
      }),
    ).toString("base64");

  return { cookieName, cookieValue };
}

async function makeContext(browser, email, password) {
  const { cookieName, cookieValue } = await loginCookie(email, password);
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: cookieName,
      value: cookieValue,
      url: baseUrl,
      httpOnly: false,
      secure: isSecureBaseUrl,
      sameSite: "Lax",
    },
  ]);
  return context;
}

async function getActiveTier() {
  const tier = await prisma.tier.findFirst({
    where: { isActive: true },
    orderBy: [{ fee: "asc" }, { sortOrder: "asc" }],
  });
  if (!tier) {
    throw new Error("No active tier found for live payment smoke");
  }
  return tier;
}

async function expectNoChallengeAccess(context, localePath = "/en") {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}${localePath}/dashboard`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    assert(
      /you have no active challenges|buy your first challenge|buy challenge|compra tu primer challenge|compre seu primeiro challenge/i.test(
        bodyText,
      ),
      `Dashboard did not show the no-challenge state: ${bodyText.slice(0, 600)}`,
    );

    await page.goto(`${baseUrl}${localePath}/dashboard/picks`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    const picksText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    assert(
      /buy challenge|buy a challenge|buy your first challenge|comprar challenge|comprar um challenge|compra tu primer challenge/i.test(
        picksText,
      ),
      `Picks page did not block users without a challenge: ${picksText.slice(0, 600)}`,
    );
  } finally {
    await page.close();
  }
}

async function postJson(context, path, body) {
  const response = await context.request.post(`${baseUrl}${path}`, {
    data: body,
    headers: { "Content-Type": "application/json" },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: response.status(), json };
}

async function countUserState(userId) {
  const [challengeCount, paymentCount, pendingPaymentCount] = await Promise.all([
    prisma.challenge.count({ where: { userId } }),
    prisma.payment.count({ where: { userId } }),
    prisma.payment.count({ where: { userId, status: "pending" } }),
  ]);
  return { challengeCount, paymentCount, pendingPaymentCount };
}

async function runAllowedFlows(browser, tier) {
  const auth = await createAuthUser("Payment Smoke Brazil");
  const user = await createAppUser({
    email: auth.email,
    supabaseId: auth.supabaseId,
    name: "Payment Smoke Brazil",
    country: "BR",
  });

  const context = await makeContext(browser, auth.email, auth.password);
  try {
    await expectNoChallengeAccess(context, "/en");

    const before = await countUserState(user.id);
    const results = {};

    async function capture(name, run) {
      try {
        results[name] = await run();
      } catch (error) {
        results[name] = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    await capture("card", async () => {
      const card = await postJson(context, "/api/checkout/stripe", {
        tierId: tier.id,
        locale: "en",
        country: "BR",
        paymentMethod: "card",
      });
      assert.equal(
        card.status,
        200,
        `Stripe card checkout failed: ${JSON.stringify(card.json)}`,
      );
      assert.match(
        card.json?.url ?? "",
        /^https:\/\/checkout\.stripe\.com\//,
        `Unexpected Stripe card checkout URL: ${card.json?.url}`,
      );
      const afterCard = await countUserState(user.id);
      assert.equal(afterCard.challengeCount, before.challengeCount);
      assert.equal(afterCard.paymentCount, before.paymentCount);
      return {
        ok: true,
        status: card.status,
        domain: new URL(card.json.url).hostname,
      };
    });

    await capture("pix", async () => {
      const pix = await postJson(context, "/api/checkout/stripe", {
        tierId: tier.id,
        locale: "pt-BR",
        country: "BR",
        paymentMethod: "pix",
      });
      assert.equal(
        pix.status,
        200,
        `Stripe Pix checkout failed: ${JSON.stringify(pix.json)}`,
      );
      assert.match(
        pix.json?.url ?? "",
        /^https:\/\/checkout\.stripe\.com\//,
        `Unexpected Stripe Pix checkout URL: ${pix.json?.url}`,
      );
      const afterPix = await countUserState(user.id);
      assert.equal(afterPix.challengeCount, before.challengeCount);
      assert.equal(afterPix.paymentCount, before.paymentCount);
      return {
        ok: true,
        status: pix.status,
        domain: new URL(pix.json.url).hostname,
      };
    });

    await capture("crypto", async () => {
      const crypto = await postJson(context, "/api/checkout/nowpayments", {
        tierId: tier.id,
        locale: "en",
        country: "BR",
        currency: "usdttrc20",
      });
      assert.equal(
        crypto.status,
        200,
        `NOWPayments checkout failed: ${JSON.stringify(crypto.json)}`,
      );
      assert.ok(crypto.json?.paymentId, "NOWPayments paymentId missing");
      assert.ok(crypto.json?.address, "NOWPayments address missing");

      const storedPending = await prisma.payment.findFirst({
        where: { userId: user.id, providerRef: crypto.json.paymentId },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(storedPending, "NOWPayments pending payment row missing");
      createdPaymentIds.push(storedPending.id);
      assert.equal(storedPending.status, "pending");

      const afterCrypto = await countUserState(user.id);
      assert.equal(afterCrypto.challengeCount, 0);
      assert.equal(afterCrypto.pendingPaymentCount, 1);

      return {
        ok: true,
        status: crypto.status,
        paymentId: crypto.json.paymentId,
        pendingPaymentPersisted: true,
      };
    });

    await capture("mercadopago", async () => {
      const mercado = await postJson(context, "/api/checkout/mercadopago", {
        tierId: tier.id,
        locale: "pt-BR",
        country: "BR",
      });
      return {
        ok: mercado.status === 410,
        status: mercado.status,
        code: mercado.json?.code ?? null,
        disabled: mercado.status === 410,
      };
    });

    await expectNoChallengeAccess(context, "/en");

    return {
      ...results,
      accessAfterInitiation: await countUserState(user.id),
    };
  } finally {
    await context.close();
  }
}

async function runBlockedCountryFlow(browser, tier) {
  const auth = await createAuthUser("Payment Smoke United States");
  const user = await createAppUser({
    email: auth.email,
    supabaseId: auth.supabaseId,
    name: "Payment Smoke United States",
    country: "US",
  });

  const context = await makeContext(browser, auth.email, auth.password);
  try {
    const stripeBlocked = await postJson(context, "/api/checkout/stripe", {
      tierId: tier.id,
      locale: "en",
      country: "US",
      paymentMethod: "card",
    });
    assert.equal(stripeBlocked.status, 403);
    assert.equal(stripeBlocked.json?.code, "COUNTRY_NOT_AVAILABLE");

    const cryptoBlocked = await postJson(context, "/api/checkout/nowpayments", {
      tierId: tier.id,
      locale: "en",
      country: "US",
      currency: "usdttrc20",
    });
    assert.equal(cryptoBlocked.status, 403);
    assert.equal(cryptoBlocked.json?.code, "COUNTRY_NOT_AVAILABLE");

    const mercadoBlocked = await postJson(context, "/api/checkout/mercadopago", {
      tierId: tier.id,
      locale: "en",
      country: "US",
    });
    assert.equal(mercadoBlocked.status, 410);
    assert.equal(mercadoBlocked.json?.code, "PAYMENT_METHOD_DISABLED");

    const finalState = await countUserState(user.id);
    assert.equal(finalState.challengeCount, 0);
    assert.equal(finalState.paymentCount, 0);

    return {
      stripe: { status: stripeBlocked.status, code: stripeBlocked.json.code },
      crypto: { status: cryptoBlocked.status, code: cryptoBlocked.json.code },
      mercadopago: {
        status: mercadoBlocked.status,
        code: mercadoBlocked.json.code,
      },
    };
  } finally {
    await context.close();
  }
}

async function cleanup() {
  if (createdPaymentIds.length > 0) {
    await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.challenge.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.payment.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.pick.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  for (const authUserId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(authUserId);
  }
}

try {
  prisma = await connectPrismaWithRetry();
  const tier = await getActiveTier();
  const browser = await chromium.launch({ headless: true });
  try {
    const allowed = await runAllowedFlows(browser, tier);
    const blocked = await runBlockedCountryFlow(browser, tier);

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          tier: { id: tier.id, name: tier.name, fee: tier.fee },
          allowed,
          blocked,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
} finally {
  await cleanup().catch(() => {});
  await prisma?.$disconnect();
}

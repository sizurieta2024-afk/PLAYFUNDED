import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { connectPrismaWithRetry } from "./lib/prisma-smoke.mjs";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3004";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase env vars are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let prisma;
const createdAuthUserIds = [];
const createdUserIds = [];
const createdChallengeIds = [];
const stamp = Date.now();

async function createAuthUser() {
  const email = `kyc-strict-smoke+${stamp}@playfunded.local`;
  const password = "PlayfundedKyc!123";
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "KYC Strict Smoke" },
  });
  if (error) throw error;
  createdAuthUserIds.push(data.user.id);
  return { email, password, supabaseId: data.user.id };
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
  return `${cookieName}=${cookieValue}`;
}

try {
  prisma = await connectPrismaWithRetry();
  const auth = await createAuthUser();
  const tier = await prisma.tier.findFirst({
    where: { isActive: true },
    orderBy: [{ fee: "asc" }, { sortOrder: "asc" }],
  });
  if (!tier) throw new Error("No active tier found");

  const user = await prisma.user.create({
    data: {
      email: auth.email,
      supabaseId: auth.supabaseId,
      name: "KYC Strict Smoke",
      country: "ES",
    },
  });
  createdUserIds.push(user.id);

  const challenge = await prisma.challenge.create({
    data: {
      userId: user.id,
      tierId: tier.id,
      status: "funded",
      phase: "funded",
      balance: tier.fundedBankroll + 1000,
      startBalance: tier.fundedBankroll,
      dailyStartBalance: tier.fundedBankroll,
      highestBalance: tier.fundedBankroll + 1000,
      peakBalance: tier.fundedBankroll + 1000,
      phase1StartBalance: tier.fundedBankroll,
      phase2StartBalance: tier.fundedBankroll,
      fundedAt: new Date(),
    },
  });
  createdChallengeIds.push(challenge.id);

  const authCookie = await loginCookie(auth.email, auth.password);
  const response = await fetch(`${baseUrl}/api/kyc/upload`, {
    method: "POST",
    headers: {
      Cookie: authCookie,
    },
    body: (() => {
      const form = new FormData();
      form.append(
        "file",
        new File([Buffer.from("%PDF-1.4\n% smoke\n", "utf8")], "proof.pdf", {
          type: "application/pdf",
        }),
      );
      return form;
    })(),
  });

  const json = await response.json();
  assert.equal(
    response.status,
    503,
    `Expected strict KYC blocking, got ${response.status}: ${JSON.stringify(json)}`,
  );
  assert.equal(json.error, "scan_unavailable");

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        status: response.status,
        error: json.error,
      },
      null,
      2,
    ),
  );
} finally {
  if (createdChallengeIds.length > 0) {
    await prisma?.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma?.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  for (const authUserId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(authUserId);
  }
  await prisma?.$disconnect();
}

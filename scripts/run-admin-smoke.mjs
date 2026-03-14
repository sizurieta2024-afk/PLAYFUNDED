import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.BASE_URL ?? "http://localhost:3002";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase env vars are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now();
const email = `admin-smoke+${stamp}@playfunded.local`;
const password = "PlayfundedAdmin!123";

let userId = null;

try {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Admin Smoke Test" },
  });
  if (error) throw error;
  userId = data.user.id;

  await prisma.user.upsert({
    where: { supabaseId: userId },
    create: {
      supabaseId: userId,
      email,
      name: "Admin Smoke Test",
      country: "ES",
      role: "admin",
    },
    update: {
      email,
      name: "Admin Smoke Test",
      country: "ES",
      role: "admin",
    },
  });

  const loginResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Supabase login failed: ${loginResponse.status} ${await loginResponse.text()}`);
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

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: cookieName,
        value: cookieValue,
        url: baseUrl,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    const checks = [];
    for (const route of ["/en/admin", "/en/admin/kyc", "/en/admin/launch"]) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      checks.push({
        route,
        status: response?.status() ?? null,
        finalUrl: page.url(),
      });
    }

    console.log(JSON.stringify({ ok: true, checks }, null, 2));
  } finally {
    await browser.close();
  }
} finally {
  if (userId) {
    await prisma.user.deleteMany({ where: { supabaseId: userId } });
    await supabase.auth.admin.deleteUser(userId);
  }
  await prisma.$disconnect();
}

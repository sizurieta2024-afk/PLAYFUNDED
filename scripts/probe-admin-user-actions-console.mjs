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

async function loginCookie(email, password) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`login failed: ${res.status} ${await res.text()}`);
  }
  const session = await res.json();
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  return {
    name: `sb-${ref}-auth-token`,
    value:
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
      ).toString("base64"),
  };
}

let prisma;
let adminAuthUserId = null;
const createdUserIds = [];

try {
  prisma = await connectPrismaWithRetry();
  const stamp = Date.now().toString();

  const adminEmail = `probe-admin-actions-${stamp}@example.com`;
  const adminPassword = "PlayfundedAdmin!123";
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: "Probe Admin Actions" },
  });
  if (error) throw error;
  adminAuthUserId = data.user.id;

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      supabaseId: adminAuthUserId,
      name: "Probe Admin Actions",
      country: "ES",
      role: "admin",
    },
  });
  createdUserIds.push(admin.id);

  const target = await prisma.user.create({
    data: {
      email: `probe-target-actions-${stamp}@example.com`,
      supabaseId: `probe-target-actions-${stamp}`,
      name: "Probe Target Actions",
      country: "ES",
    },
  });
  createdUserIds.push(target.id);

  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const context = await browser.newContext();
    const cookie = await loginCookie(adminEmail, adminPassword);
    await context.addCookies([
      {
        ...cookie,
        url: baseUrl,
        httpOnly: false,
        secure: true,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`${baseUrl}/en/admin/users/${target.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Ban user" }).click();
    await page.waitForTimeout(2000);

    const body = await page.locator("body").innerText();
    const reasonCount = await page.getByPlaceholder("Ban reason (required)").count();

    console.log(JSON.stringify({
      ok: true,
      url: page.url(),
      reasonCount,
      consoleErrors,
      pageErrors,
      body: body.replace(/\s+/g, " ").trim().slice(0, 1600),
    }, null, 2));

    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  if (createdUserIds.length > 0) {
    await prisma?.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  }
  if (adminAuthUserId) {
    await supabase.auth.admin.deleteUser(adminAuthUserId).catch(() => {});
  }
  await prisma?.$disconnect();
}

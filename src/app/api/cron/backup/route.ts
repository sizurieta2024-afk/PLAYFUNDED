import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase";
import { isCronAuthorized } from "@/lib/auth-cron";

// Runs daily at 03:00 UTC via Vercel Cron.
// Exports all business-critical tables to JSON and uploads to Supabase Storage
// bucket "backups" under the path: backups/YYYY-MM-DD/[table].json
//
// Vercel Cron sends GET — alias so both work
export { POST as GET };

const BUCKET = "backups";

async function uploadJson(
  supabase: ReturnType<typeof createServiceClient>,
  path: string,
  data: unknown,
): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error)
    throw new Error(`Storage upload failed for ${path}: ${error.message}`);
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const prefix = `${date}`;

  const counts: Record<string, number> = {};
  const errors: string[] = [];

  const tables: Array<{ name: string; fetch: () => Promise<unknown[]> }> = [
    { name: "User", fetch: () => prisma.user.findMany() },
    { name: "Challenge", fetch: () => prisma.challenge.findMany() },
    { name: "Pick", fetch: () => prisma.pick.findMany() },
    { name: "ParlayLeg", fetch: () => prisma.parlayLeg.findMany() },
    { name: "Payment", fetch: () => prisma.payment.findMany() },
    { name: "Payout", fetch: () => prisma.payout.findMany() },
    { name: "PayoutProfile", fetch: () => prisma.payoutProfile.findMany() },
    { name: "KycSubmission", fetch: () => prisma.kycSubmission.findMany() },
    { name: "Affiliate", fetch: () => prisma.affiliate.findMany() },
    {
      name: "AffiliateConversion",
      fetch: () => prisma.affiliateConversion.findMany(),
    },
    { name: "AuditLog", fetch: () => prisma.auditLog.findMany() },
    { name: "MarketRequest", fetch: () => prisma.marketRequest.findMany() },
  ];

  for (const table of tables) {
    try {
      const rows = await table.fetch();
      await uploadJson(supabase, `${prefix}/${table.name}.json`, rows);
      counts[table.name] = rows.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[backup] Failed to back up ${table.name}:`, msg);
      errors.push(`${table.name}: ${msg}`);
    }
  }

  // Write a manifest for this backup so we can verify it later
  const manifest = {
    date,
    createdAt: new Date().toISOString(),
    tables: counts,
    errors: errors.length > 0 ? errors : undefined,
  };

  try {
    await uploadJson(supabase, `${prefix}/manifest.json`, manifest);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`manifest: ${msg}`);
  }

  const status = errors.length > 0 ? 207 : 200;
  return NextResponse.json(
    { ok: errors.length === 0, date, counts, errors },
    { status },
  );
}

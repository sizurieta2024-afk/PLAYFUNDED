import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Runs daily at 00:00 UTC via Vercel Cron.
// Resets dailyStartBalance = current balance for all active challenges.
// This is the reference point for the 10% daily loss limit check.
//
// Note: raw SQL is used here because Prisma's updateMany does not support
// setting a column equal to another column in the same row.

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.$executeRaw`
    UPDATE "Challenge"
    SET "dailyStartBalance" = "balance"
    WHERE status = 'active'
  `;

  return NextResponse.json({
    ok: true,
    updated: result,
    resetAt: new Date().toISOString(),
  });
}

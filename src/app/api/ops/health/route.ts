import { NextRequest, NextResponse } from "next/server";
import { getOpsHealthSummary } from "@/lib/ops-monitor";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const summary = await getOpsHealthSummary();
  return NextResponse.json(summary, {
    status: summary.ok ? 200 : 503,
  });
}

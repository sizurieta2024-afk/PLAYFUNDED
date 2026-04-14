import { NextRequest, NextResponse } from "next/server";
import { getOpsHealthSummary } from "@/lib/ops-monitor";
import { isCronAuthorized } from "@/lib/auth-cron";

function isAuthorized(req: NextRequest): boolean {
  return isCronAuthorized(req);
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

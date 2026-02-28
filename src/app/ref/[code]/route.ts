import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const affiliate = await prisma.affiliate.findUnique({ where: { code } });
  if (!affiliate) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? undefined;

  await prisma.$transaction([
    prisma.affiliateClick.create({
      data: { affiliateId: affiliate.id, ip, userAgent },
    }),
    prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { totalClicks: { increment: 1 } },
    }),
  ]);

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set("pf_ref", code, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}

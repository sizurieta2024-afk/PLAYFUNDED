import type { Metadata } from "next";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const affiliate = authUser
    ? await prisma.affiliate.findFirst({
        where: { user: { supabaseId: authUser.id }, isActive: true },
        select: { id: true },
      })
    : null;

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <DashboardSidebar showAffiliate={Boolean(affiliate)} />
      {/* Main content — right of sidebar, with mobile bottom-nav padding */}
      <div className="flex-1 min-w-0 pb-20 md:pb-0">{children}</div>
    </div>
  );
}

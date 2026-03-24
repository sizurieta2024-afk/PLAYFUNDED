import type { Metadata } from "next";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let isAffiliate = false;
  if (authUser) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { affiliate: { select: { id: true } } },
    });
    isAffiliate = !!dbUser?.affiliate;
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <DashboardSidebar isAffiliate={isAffiliate} />
      {/* Main content — right of sidebar, with mobile bottom-nav padding */}
      <div className="flex-1 min-w-0 pb-20 md:pb-0">{children}</div>
    </div>
  );
}

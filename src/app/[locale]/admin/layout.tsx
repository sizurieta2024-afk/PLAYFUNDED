import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { buildDashboardPath, buildLoginPath } from "@/i18n/navigation";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) redirect(buildLoginPath(locale));

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
  });
  if (!user || user.role !== "admin") redirect(buildDashboardPath(locale));

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 min-w-0 px-6 py-8 overflow-x-auto">
        {children}
      </main>
    </div>
  );
}

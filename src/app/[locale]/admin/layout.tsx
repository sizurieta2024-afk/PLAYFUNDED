import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
  });
  if (!user || user.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 min-w-0 px-6 py-8 overflow-x-auto">
        {children}
      </main>
    </div>
  );
}

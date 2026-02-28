import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
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

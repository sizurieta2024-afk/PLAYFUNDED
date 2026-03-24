import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  const isAuthenticated = !authError && !!authUser;

  // Admins live in /admin — redirect them away from the regular site
  if (isAuthenticated && authUser) {
    const user = await prisma.user.findFirst({
      where: { supabaseId: authUser.id },
      select: { role: true },
    });
    if (user?.role === "admin") {
      redirect("/admin");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatWidget />
    </div>
  );
}

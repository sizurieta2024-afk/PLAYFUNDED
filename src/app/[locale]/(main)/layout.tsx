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
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Admins live in /admin — redirect them away from the regular site
  if (session) {
    const user = await prisma.user.findFirst({
      where: { supabaseId: session.user.id },
      select: { role: true },
    });
    if (user?.role === "admin") {
      redirect("/admin");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar isAuthenticated={!!session} />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatWidget />
    </div>
  );
}

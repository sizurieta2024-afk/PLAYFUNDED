import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { isChatConfigured } from "@/lib/chat-config";

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
  const chatEnabled = isChatConfigured();

  let userContext:
    | {
        phase?: string;
        tierName?: string;
        balance?: number;
        startBalance?: number;
        activePicks?: number;
      }
    | undefined;

  // Admins live in /admin — redirect them away from the regular site
  if (isAuthenticated && authUser) {
    const user = await prisma.user.findFirst({
      where: { supabaseId: authUser.id },
      select: {
        role: true,
        challenges: {
          where: { status: { in: ["active", "funded"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            phase: true,
            balance: true,
            startBalance: true,
            tier: { select: { name: true } },
            picks: { where: { status: "pending" }, select: { id: true } },
          },
        },
      },
    });
    if (user?.role === "admin") {
      redirect("/admin");
    }
    const activeChallenge = user?.challenges[0];
    if (activeChallenge) {
      userContext = {
        phase: activeChallenge.phase,
        tierName: activeChallenge.tier.name,
        balance: activeChallenge.balance,
        startBalance: activeChallenge.startBalance,
        activePicks: activeChallenge.picks.length,
      };
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="flex-1">{children}</main>
      <Footer />
      {chatEnabled ? <ChatWidget userContext={userContext} /> : null}
    </div>
  );
}

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { PlayCard } from "@/components/dashboard/play-card";
import { DashboardCategoryMMR } from "@/components/dashboard/category-mmr";
import { DashboardClient, DashboardDiscordCard, DashboardShortcuts } from "@/components/dashboard/dashboard-client";
import { DashboardWrapper } from "@/components/dashboard/dashboard-wrapper";
import { Navbar } from "@/components/navbar";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;
  const displayName = (user as any).displayName || user.name || "Player";

  // Récupérer les dernières parties de l'utilisateur
  const recentMatches = await prisma.matchPlayer.findMany({
    where: { userId: user.id },
    include: { match: true },
    orderBy: { match: { createdAt: 'desc' } },
    take: 5,
  });

  // Mapper les données pour le client component
  const matchesForClient = recentMatches.map(mp => ({
    id: mp.id,
    placement: mp.placement,
    points: mp.points,
    mmrChange: mp.mmrChange,
    match: {
      category: mp.match.category,
    }
  }));

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <DashboardWrapper>
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column - MMR & Stats */}
              <div className="lg:col-span-2 space-y-6">
                {/* Player Header + Recent Matches (Client) */}
                <DashboardClient 
                  displayName={displayName} 
                  userId={user.id} 
                  recentMatches={matchesForClient} 
                />
                
                {/* MMR Par Catégorie */}
                <DashboardCategoryMMR />
              </div>

              {/* Right Column - Play */}
              <div className="space-y-6">
                <PlayCard />
                <DashboardDiscordCard />
                <DashboardShortcuts userId={user.id} />
              </div>
            </div>
          </DashboardWrapper>
        </div>
      </main>
    </div>
  );
}


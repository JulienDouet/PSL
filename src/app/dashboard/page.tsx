import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRankProgress } from "@/lib/mmr";
import { PlayCard } from "@/components/dashboard/play-card";
import { DashboardCategoryMMR } from "@/components/dashboard/category-mmr";
import { Navbar } from "@/components/navbar";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;

  // User stats (from session or defaults)
  const userStats = {
    mmr: (user as any).mmr || 1000,
    gamesPlayed: (user as any).gamesPlayed || 0,
    displayName: (user as any).displayName || user.name || "Player",
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: 0,
    leaderboardPosition: 99,
  };

  const rankInfo = getRankProgress(userStats.mmr);
  const isCalibrating = userStats.gamesPlayed < 5;

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <Navbar />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Player Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Bienvenue, <span className="text-gradient">{userStats.displayName}</span> !
            </h1>
            <p className="text-muted-foreground">
              Prêt à grimper dans le classement ?
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - MMR & Stats */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* MMR Par Catégorie (Nouveau composant principal) */}
              <DashboardCategoryMMR />

              {/* Recent Matches */}
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle>🕐 Dernières parties</CardTitle>
                </CardHeader>
                <CardContent>
                  {userStats.gamesPlayed === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-4xl mb-2">🎮</div>
                      <p>Aucune partie jouée pour l&apos;instant</p>
                      <p className="text-sm">Lance ta première recherche !</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-secondary/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-green-400 font-bold">1er</span>
                          <span className="text-muted-foreground">vs 5 joueurs</span>
                        </div>
                        <span className="text-green-400">+12 MMR</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Play */}
            <div className="space-y-6">
              {/* Play Card */}
              <PlayCard />

              {/* Quick Links */}
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle>⚡ Raccourcis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/leaderboard" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      🏆 Voir le classement
                    </Button>
                  </Link>
                  <Link href={`/profile/${user.id}`} className="block">
                    <Button variant="outline" className="w-full justify-start">
                      👤 Mon profil
                    </Button>
                  </Link>
                  <a href="https://discord.gg/psl" target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      💬 Discord PSL
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

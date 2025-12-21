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
              {/* MMR Card */}
              <Card className="bg-card border-border/50 card-glow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{rankInfo.currentRank.icon}</span>
                    {isCalibrating ? (
                      <span>En Calibration</span>
                    ) : (
                      <span>{rankInfo.currentRank.displayName}</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isCalibrating
                      ? `${5 - userStats.gamesPlayed} parties restantes`
                      : `#${userStats.leaderboardPosition} au classement`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-4 mb-4">
                    <div className="text-5xl font-bold text-gradient">
                      {userStats.mmr}
                    </div>
                    <div className="text-muted-foreground mb-1">MMR</div>
                  </div>

                  {/* Progress bar */}
                  {rankInfo.nextRank && !isCalibrating && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span style={{ color: rankInfo.currentRank.color }}>
                          {rankInfo.currentRank.icon} {rankInfo.currentRank.displayName}
                        </span>
                        <span className="text-muted-foreground">
                          {rankInfo.remaining} MMR → {rankInfo.nextRank.displayName}
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-psl transition-all duration-500"
                          style={{ width: `${rankInfo.progress * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Season Stats */}
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle>📊 Cette saison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-secondary/50">
                      <div className="text-2xl font-bold">{userStats.gamesPlayed}</div>
                      <div className="text-sm text-muted-foreground">Parties</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-secondary/50">
                      <div className="text-2xl font-bold text-green-400">{userStats.wins}</div>
                      <div className="text-sm text-muted-foreground">Victoires</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-secondary/50">
                      <div className="text-2xl font-bold">{userStats.winRate}%</div>
                      <div className="text-sm text-muted-foreground">Winrate</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-secondary/50">
                      <div className="text-2xl font-bold text-primary">
                        {userStats.currentStreak > 0 ? `${userStats.currentStreak}W` : "-"}
                      </div>
                      <div className="text-sm text-muted-foreground">Streak</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

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

              {/* MMR par mode */}
              <DashboardCategoryMMR />

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

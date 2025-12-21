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
import { prisma } from "@/lib/prisma";

const CATEGORY_INFO: Record<string, { label: string; emoji: string }> = {
  GP_FR: { label: 'Grand Public [FR]', emoji: '🍿' },
  MS_EN: { label: 'Mainstream [EN]', emoji: '🍿' },
  ANIME: { label: 'Anime', emoji: '🎌' },
  FLAGS: { label: 'Drapeaux', emoji: '🚩' },
  NOFILTER_FR: { label: 'Sans Filtre [FR]', emoji: '🔥' },
  NOFILTER_EN: { label: 'No Filter [EN]', emoji: '🔥' },
};

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

  // Récupérer les dernières parties de l'utilisateur
  const recentMatches = await prisma.matchPlayer.findMany({
    where: { userId: user.id },
    include: { match: true },
    orderBy: { match: { createdAt: 'desc' } },
    take: 5,
  });

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
                  {recentMatches.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-4xl mb-2">🎮</div>
                      <p>Aucune partie jouée pour l&apos;instant</p>
                      <p className="text-sm">Lance ta première recherche !</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentMatches.map((mp) => {
                        const catInfo = CATEGORY_INFO[mp.match.category] || { label: mp.match.category, emoji: '🎮' };
                        return (
                          <div
                            key={mp.id}
                            className="p-3 rounded-lg bg-secondary/30 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{catInfo.emoji}</span>
                              <span className={mp.placement === 1 ? "text-green-400 font-bold" : "text-muted-foreground"}>
                                {mp.placement === 1 ? "🥇 1er" : `#${mp.placement}`}
                              </span>
                              <span className="text-muted-foreground text-sm">
                                {mp.points} pts
                              </span>
                            </div>
                            <span className={mp.mmrChange && mp.mmrChange > 0 ? "text-green-400" : "text-red-400"}>
                              {mp.mmrChange && mp.mmrChange > 0 ? "+" : ""}{mp.mmrChange} MMR
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Play */}
            <div className="space-y-6">
              {/* Play Card */}
              <PlayCard />

              {/* Discord Notification Card */}
              <Card className="bg-[#5865F2]/10 border-[#5865F2]/20">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-[#5865F2] text-white p-2 rounded-full shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18.942 5.556a16.299 16.299 0 0 0-4.126-1.297c-.178.321-.385.754-.529 1.097a15.08 15.08 0 0 0-4.575 0 2.44 2.44 0 0 0-.533-1.097A16.288 16.288 0 0 0 5.055 5.556a16.097 16.097 0 0 0-3.078 12.012 16.155 16.155 0 0 0 4.978 2.503 12.028 12.028 0 0 0 1.077-1.776 10.74 10.74 0 0 1-1.579-.753.868.868 0 0 1 .159-.395c3.153 1.458 6.57 1.458 9.684 0 .052.138.106.27.163.4.455.24.914.475 1.385.717a12.163 12.163 0 0 0 1.282 1.803 16.134 16.134 0 0 0 4.97-2.5 16.103 16.103 0 0 0-3.069-12.012zM8.618 13.905c-1.124 0-2.052-1.036-2.052-2.304 0-1.268.914-2.304 2.052-2.304 1.151 0 2.079 1.036 2.079 2.304 0 1.268-.914 2.304-2.079 2.304zm6.756 0c-1.124 0-2.052-1.036-2.052-2.304 0-1.268.914-2.304 2.052-2.304 1.151 0 2.079 1.036 2.079 2.304 0 1.268-.928 2.304-2.079 2.304z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div className="text-sm">
                    Rejoins le <a href="https://discord.gg/JGHRNy6qRn" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5865F2] hover:underline">Discord</a> pour être notifié quand quelqu&apos;un recherche une partie !
                  </div>
                </CardContent>
              </Card>

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

                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

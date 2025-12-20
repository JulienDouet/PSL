import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { getRankProgress, RANKS } from "@/lib/mmr";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;

  // Récupérer l'utilisateur depuis la base de données
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      matchPlayers: {
        orderBy: { match: { createdAt: 'desc' } },
        take: 10,
        include: {
          match: true
        }
      }
    }
  });

  if (!user) {
    notFound();
  }

  const displayName = user.displayName || user.name || "Joueur";
  const mmr = user.mmr || 1000;
  const gamesPlayed = user.gamesPlayed || 0;
  const rankInfo = getRankProgress(mmr);
  const isCalibrating = gamesPlayed < 5;

  // Calculer les stats
  const wins = user.matchPlayers.filter(mp => mp.placement === 1).length;
  const losses = gamesPlayed - wins;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Profile Header */}
          <Card className="bg-card border-border/50 card-glow mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-4xl border-2 border-primary/30 overflow-hidden">
                  {user.image ? (
                    <img src={user.image} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    displayName[0]?.toUpperCase() || "?"
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-1">
                    <span className="text-gradient">{displayName}</span>
                  </h1>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-2xl">{rankInfo.currentRank.icon}</span>
                    {isCalibrating ? (
                      <span>En calibration ({gamesPlayed}/5)</span>
                    ) : (
                      <span style={{ color: rankInfo.currentRank.color }}>
                        {rankInfo.currentRank.displayName}
                      </span>
                    )}
                  </div>
                </div>

                {/* MMR Display */}
                <div className="text-right">
                  <div className="text-4xl font-bold text-gradient">{mmr}</div>
                  <div className="text-sm text-muted-foreground">MMR</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-card border-border/50">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold">{gamesPlayed}</div>
                <div className="text-sm text-muted-foreground">Parties</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-400">{wins}</div>
                <div className="text-sm text-muted-foreground">Victoires</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-red-400">{losses}</div>
                <div className="text-sm text-muted-foreground">Défaites</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="pt-6 text-center">
                <div className={`text-3xl font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                  {winRate}%
                </div>
                <div className="text-sm text-muted-foreground">Winrate</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Matches */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle>🕐 Dernières parties</CardTitle>
            </CardHeader>
            <CardContent>
              {user.matchPlayers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="text-4xl mb-2">🎮</div>
                  <p>Aucune partie jouée pour l&apos;instant</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {user.matchPlayers.map((mp) => (
                    <div
                      key={mp.id}
                      className="p-3 rounded-lg bg-secondary/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

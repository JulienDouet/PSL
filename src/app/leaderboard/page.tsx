import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RANKS } from "@/lib/mmr";
import { Navbar } from "@/components/navbar";
import { prisma } from "@/lib/prisma";

function getRankForMMR(mmr: number, position: number) {
  // Grand Maître pour le top 5
  if (position <= 5) {
    return { ...RANKS[RANKS.length - 1], icon: '🏆', displayName: 'Grand Maître' };
  }
  const rank = RANKS.find(r => mmr >= r.min && (r.max === Infinity || mmr <= r.max));
  return rank || RANKS[0];
}

function getPositionBadge(position: number) {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return `#${position}`;
}

async function getLeaderboard() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      displayName: true,
      mmr: true,
      image: true,
      _count: {
        select: {
          matchPlayers: true
        }
      }
    },
    orderBy: {
      mmr: 'desc'
    },
    take: 100
  });

  // Filtrer pour ne garder que les joueurs avec au moins une partie
  const playersWithGames = users.filter(u => u._count.matchPlayers > 0);

  // Calculer wins/losses pour chaque joueur
  const leaderboard = await Promise.all(playersWithGames.map(async (user, index) => {
    // Le gagnant est celui avec placement = 1
    const winsCount = await prisma.matchPlayer.count({
      where: { userId: user.id, placement: 1 }
    });
    
    const totalGames = user._count.matchPlayers;
    
    return {
      id: user.id,
      displayName: user.displayName || user.name || 'Joueur',
      image: user.image,
      mmr: user.mmr || 1000,
      wins: winsCount,
      losses: totalGames - winsCount,
      position: index + 1
    };
  }));

  return leaderboard;
}

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboard();
  
  // Fallback si pas assez de joueurs pour le podium
  const top3 = leaderboard.slice(0, 3);
  const hasTop3 = top3.length >= 3;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">
              🏆 <span className="text-gradient">Classement</span>
            </h1>
            <p className="text-muted-foreground">
              Saison Décembre 2025
            </p>
          </div>

          {/* Top 3 Podium */}
          {hasTop3 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* 2nd Place */}
              <Card className="bg-card border-border/50 mt-8 text-center">
                <CardContent className="pt-6">
                  <div className="text-4xl mb-2">🥈</div>
                  <div className="font-bold">{top3[1].displayName}</div>
                  <div className="text-2xl font-bold text-gradient">{top3[1].mmr}</div>
                  <div className="text-sm text-muted-foreground">MMR</div>
                </CardContent>
              </Card>

              {/* 1st Place */}
              <Card className="bg-card border-primary/50 card-glow text-center">
                <CardContent className="pt-6">
                  <div className="text-5xl mb-2 animate-float">🥇</div>
                  <div className="font-bold text-lg">{top3[0].displayName}</div>
                  <div className="text-3xl font-bold text-gradient">{top3[0].mmr}</div>
                  <div className="text-sm text-muted-foreground">MMR</div>
                  <div className="mt-2 text-xs px-2 py-1 rounded-full bg-primary/20 text-primary inline-block">
                    🏆 Grand Maître
                  </div>
                </CardContent>
              </Card>

              {/* 3rd Place */}
              <Card className="bg-card border-border/50 mt-8 text-center">
                <CardContent className="pt-6">
                  <div className="text-4xl mb-2">🥉</div>
                  <div className="font-bold">{top3[2].displayName}</div>
                  <div className="text-2xl font-bold text-gradient">{top3[2].mmr}</div>
                  <div className="text-sm text-muted-foreground">MMR</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Leaderboard Table */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle>Top 100</CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun joueur classé pour le moment. Joue des parties pour apparaître ici !
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-sm text-muted-foreground font-medium">
                    <div className="col-span-1">#</div>
                    <div className="col-span-5">Joueur</div>
                    <div className="col-span-2 text-center">MMR</div>
                    <div className="col-span-2 text-center">W/L</div>
                    <div className="col-span-2 text-center">Winrate</div>
                  </div>

                  {/* Rows */}
                  {leaderboard.map((player) => {
                    const rank = getRankForMMR(player.mmr, player.position);
                    const totalGames = player.wins + player.losses;
                    const winRate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;
                    const isTop3 = player.position <= 3;

                    return (
                      <Link
                        key={player.id}
                        href={`/profile/${player.id}`}
                        className={`grid grid-cols-12 gap-2 px-4 py-3 rounded-lg transition-all hover:bg-secondary/50 ${
                          isTop3 ? "bg-primary/5 border border-primary/20" : "bg-secondary/20"
                        }`}
                      >
                        <div className="col-span-1 font-bold">
                          {getPositionBadge(player.position)}
                        </div>
                        <div className="col-span-5 flex items-center gap-2">
                          {player.image && (
                            <img src={player.image} alt="" className="w-6 h-6 rounded-full" />
                          )}
                          <span>{rank.icon}</span>
                          <span className="font-medium">{player.displayName}</span>
                        </div>
                        <div className="col-span-2 text-center font-bold text-gradient">
                          {player.mmr}
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-green-400">{player.wins}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-red-400">{player.losses}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className={winRate >= 50 ? "text-green-400" : "text-red-400"}>
                            {winRate}%
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/50">
        <div className="container mx-auto flex items-center justify-center gap-4 text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Accueil
          </Link>
          <span>•</span>
          <a href="https://discord.gg/psl" className="hover:text-foreground transition-colors">
            Discord
          </a>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RANKS } from "@/lib/mmr";

// Mock data - will come from database
const mockLeaderboard = [
  { id: "1", displayName: "Hyceman", mmr: 2450, wins: 38, losses: 9, position: 1 },
  { id: "2", displayName: "Player2", mmr: 2320, wins: 35, losses: 12, position: 2 },
  { id: "3", displayName: "Player3", mmr: 2180, wins: 30, losses: 15, position: 3 },
  { id: "4", displayName: "Player4", mmr: 2050, wins: 28, losses: 18, position: 4 },
  { id: "5", displayName: "Player5", mmr: 1980, wins: 25, losses: 20, position: 5 },
  { id: "6", displayName: "Player6", mmr: 1920, wins: 24, losses: 22, position: 6 },
  { id: "7", displayName: "Player7", mmr: 1850, wins: 22, losses: 24, position: 7 },
  { id: "8", displayName: "Player8", mmr: 1750, wins: 20, losses: 25, position: 8 },
  { id: "9", displayName: "Player9", mmr: 1650, wins: 18, losses: 27, position: 9 },
  { id: "10", displayName: "Player10", mmr: 1550, wins: 15, losses: 30, position: 10 },
];

function getRankForMMR(mmr: number, position: number) {
  if (position <= 5) return RANKS.find(r => r.name === "GRAND_MASTER")!;
  return RANKS.find(r => mmr >= r.minMMR && mmr <= r.maxMMR) || RANKS[0];
}

function getPositionBadge(position: number) {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return `#${position}`;
}

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">🎮</span>
            <span className="text-gradient">PSL</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link href="/leaderboard" className="text-foreground font-medium">
              Classement
            </Link>
            <Link href="/login">
              <Button variant="outline" className="border-primary/50 hover:border-primary hover:bg-primary/10">
                Connexion
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">
              🏆 <span className="text-gradient">Classement</span>
            </h1>
            <p className="text-muted-foreground">
              Saison Décembre 2024
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6 justify-center">
            <Button variant="secondary" size="sm" className="bg-primary/20 text-primary border-primary/30">
              Cette saison
            </Button>
            <Button variant="outline" size="sm">
              All-time
            </Button>
            <Button variant="outline" size="sm">
              Top 10
            </Button>
            <Button variant="outline" size="sm">
              Autour de moi
            </Button>
          </div>

          {/* Top 3 Podium */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* 2nd Place */}
            <Card className="bg-card border-border/50 mt-8 text-center">
              <CardContent className="pt-6">
                <div className="text-4xl mb-2">🥈</div>
                <div className="font-bold">{mockLeaderboard[1].displayName}</div>
                <div className="text-2xl font-bold text-gradient">{mockLeaderboard[1].mmr}</div>
                <div className="text-sm text-muted-foreground">MMR</div>
              </CardContent>
            </Card>

            {/* 1st Place */}
            <Card className="bg-card border-primary/50 card-glow text-center">
              <CardContent className="pt-6">
                <div className="text-5xl mb-2 animate-float">🥇</div>
                <div className="font-bold text-lg">{mockLeaderboard[0].displayName}</div>
                <div className="text-3xl font-bold text-gradient">{mockLeaderboard[0].mmr}</div>
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
                <div className="font-bold">{mockLeaderboard[2].displayName}</div>
                <div className="text-2xl font-bold text-gradient">{mockLeaderboard[2].mmr}</div>
                <div className="text-sm text-muted-foreground">MMR</div>
              </CardContent>
            </Card>
          </div>

          {/* Leaderboard Table */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle>Top 100</CardTitle>
            </CardHeader>
            <CardContent>
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
                {mockLeaderboard.map((player) => {
                  const rank = getRankForMMR(player.mmr, player.position);
                  const winRate = Math.round((player.wins / (player.wins + player.losses)) * 100);
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

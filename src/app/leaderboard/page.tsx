'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { GAME_MODE_LIST, type GameModeKey } from '@/lib/game-modes';

// Types pour le leaderboard
interface LeaderboardEntry {
  id: string;
  displayName: string;
  image: string | null;
  mmr: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  position: number;
  rank: {
    name: string;
    icon: string;
  };
}

// Mapping des modes vers les catégories pour le leaderboard
const LEADERBOARD_CATEGORIES = [
  { key: 'GP', label: 'GP / MS', emoji: '🌐' },
  { key: 'ANIME', label: 'Anime', emoji: '🎌' },
  { key: 'FLAGS', label: 'Drapeaux', emoji: '🚩' },
  { key: 'NOFILTER', label: 'Sans Filtre', emoji: '🔥' }
];

function getPositionBadge(position: number) {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return `#${position}`;
}

export default function LeaderboardPage() {
  const [activeCategory, setActiveCategory] = useState('GP');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const res = await fetch(`/api/leaderboard?category=${activeCategory}`);
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard || []);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      }
      setLoading(false);
    }
    fetchLeaderboard();
  }, [activeCategory]);

  const top3 = leaderboard.slice(0, 3);
  const hasTop3 = top3.length >= 3;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold mb-2">
              🏆 <span className="text-gradient">Classement</span>
            </h1>
            <p className="text-muted-foreground">
              Saison Décembre 2025
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {LEADERBOARD_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeCategory === cat.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/50 hover:bg-secondary text-muted-foreground'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin text-4xl">🔄</div>
              <p className="text-muted-foreground mt-2">Chargement...</p>
            </div>
          )}

          {/* Top 3 Podium */}
          {!loading && hasTop3 && (
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
          {!loading && (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle>Top 100 - {LEADERBOARD_CATEGORIES.find(c => c.key === activeCategory)?.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun joueur classé dans cette catégorie. Joue des parties pour apparaître ici !
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
                            <span>{player.rank.icon}</span>
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
          )}
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

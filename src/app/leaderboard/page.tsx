'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { GAME_MODE_LIST, type GameModeKey } from '@/lib/game-modes';
import { SpeedRecords } from "@/components/leaderboard/speed-records";
import { useTranslation } from "@/lib/i18n/context";
import { Flame, Crown, Medal } from 'lucide-react';
import type { Category, SoloMode } from '@prisma/client';

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

function getPositionBadge(position: number) {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return `#${position}`;
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'mmr' | 'speed' | 'solo'>('mmr');
  const [activeCategory, setActiveCategory] = useState('GP_FR');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Solo mode state
  const [soloCategory, setSoloCategory] = useState<Category>('GP_FR');
  const [soloMode, setSoloMode] = useState<SoloMode>('NORMAL');
  const [soloLeaderboard, setSoloLeaderboard] = useState<any[]>([]);
  const [soloLoading, setSoloLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { t } = useTranslation();

  // Check admin status on mount
  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch('/api/solo/start');
        // If we get 200 or even 409, user has access (admin)
        if (res.ok || res.status === 409) {
          setIsAdmin(true);
        }
      } catch (err) {
        // Not admin
      }
    }
    checkAdmin();
  }, []);

  // Catégories pour le leaderboard (correspondant aux modes de jeu)
  const LEADERBOARD_CATEGORIES = [
    { key: 'GP_FR', emoji: '🍿' },
    { key: 'MS_EN', emoji: '🍿' },
    { key: 'ANIME', emoji: '🎌' },
    { key: 'FLAGS', emoji: '🚩' },
    { key: 'NOFILTER_FR', emoji: '🔥' },
    { key: 'NOFILTER_EN', emoji: '🔥' }
  ];

  // Fetch MMR leaderboard only when needed
  useEffect(() => {
    if (activeTab !== 'mmr') return;
    
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
  }, [activeCategory, activeTab]);

  // Fetch Solo leaderboard
  useEffect(() => {
    if (activeTab !== 'solo') return;
    
    async function fetchSoloLeaderboard() {
      setSoloLoading(true);
      try {
        const res = await fetch(`/api/solo/leaderboard?category=${soloCategory}&mode=${soloMode}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          setSoloLeaderboard(data.leaderboard || []);
        }
      } catch (err) {
        console.error('Error fetching solo leaderboard:', err);
      }
      setSoloLoading(false);
    }
    fetchSoloLeaderboard();
  }, [soloCategory, soloMode, activeTab]);

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
              🏆 <span className="text-gradient">{t.leaderboard.title}</span>
            </h1>
            <p className="text-muted-foreground">
              {t.leaderboard.subtitle}
            </p>
          </div>

          {/* Main Tabs */}
          <div className="flex justify-center gap-4 mb-8">
            <button
                onClick={() => setActiveTab('mmr')}
                className={`px-6 py-2 rounded-full font-bold transition-all ${
                    activeTab === 'mmr' 
                    ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
            >
                {t.leaderboard.tabs.mmr}
            </button>
            <button
                onClick={() => setActiveTab('speed')}
                className={`px-6 py-2 rounded-full font-bold transition-all ${
                    activeTab === 'speed' 
                    ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
            >
                {t.leaderboard.tabs.speed}
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('solo')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'solo' 
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-105' 
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <Flame className="w-4 h-4" />
                Solo
              </button>
            )}
          </div>

          {/* VIEW: MMR LEADERBOARD */}
          {activeTab === 'mmr' && (
            <>
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
                        <span>{t.categories[cat.key as keyof typeof t.categories]}</span>
                    </button>
                    ))}
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-12">
                    <div className="inline-block animate-spin text-4xl">🔄</div>
                    <p className="text-muted-foreground mt-2">{t.common.loading}</p>
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
                            🏆 {t.ranks.grandMaster}
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
                        <CardTitle>Top 100 - {t.categories[activeCategory as keyof typeof t.categories]}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {leaderboard.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {t.leaderboard.no_players}
                        </div>
                        ) : (
                        <div className="space-y-2">
                            {/* Header */}
                            <div className="grid grid-cols-8 md:grid-cols-12 gap-2 px-4 py-2 text-sm text-muted-foreground font-medium">
                            <div className="col-span-1">{t.leaderboard.table.rank}</div>
                            <div className="col-span-5">{t.leaderboard.table.player}</div>
                            <div className="col-span-2 text-center">{t.leaderboard.table.mmr}</div>
                            <div className="col-span-2 text-center hidden md:block">{t.leaderboard.table.wl}</div>
                            <div className="col-span-2 text-center hidden md:block">{t.leaderboard.table.winrate}</div>
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
                                className={`grid grid-cols-8 md:grid-cols-12 items-center gap-2 px-4 py-3 rounded-lg transition-all hover:bg-secondary/50 ${
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
                                <div className="col-span-2 text-center hidden md:block">
                                    <span className="text-green-400">{player.wins}</span>
                                    <span className="text-muted-foreground">/</span>
                                    <span className="text-red-400">{player.losses}</span>
                                </div>
                                <div className="col-span-2 text-center hidden md:block">
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
            </>
          )}

          {/* VIEW: SPEED RECORDS */}
          {activeTab === 'speed' && (
            <SpeedRecords />
          )}

          {/* VIEW: SOLO STREAK LEADERBOARD */}
          {activeTab === 'solo' && (
            <>
              {/* Category + Mode Filters */}
              <div className="space-y-4 mb-8">
                {/* Categories */}
                <div className="flex justify-center gap-2 flex-wrap">
                  {LEADERBOARD_CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => setSoloCategory(cat.key as Category)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        soloCategory === cat.key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/50 hover:bg-secondary text-muted-foreground'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{t.categories[cat.key as keyof typeof t.categories]}</span>
                    </button>
                  ))}
                </div>
                
                {/* Mode selector */}
                <div className="flex justify-center gap-2">
                  {(['NORMAL', 'CHALLENGE', 'HARDCORE'] as SoloMode[]).map((mode) => {
                    const modeConfig = {
                      NORMAL: { emoji: '🎯', label: 'Normal', activeClass: 'bg-blue-500 text-white' },
                      CHALLENGE: { emoji: '⚡', label: 'Challenge', activeClass: 'bg-purple-500 text-white' },
                      HARDCORE: { emoji: '💀', label: 'Hardcore', activeClass: 'bg-gradient-to-r from-orange-500 to-red-500 text-white' }
                    };
                    return (
                      <button
                        key={mode}
                        onClick={() => setSoloMode(mode)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          soloMode === mode
                            ? modeConfig[mode].activeClass
                            : 'bg-secondary/50 hover:bg-secondary text-muted-foreground'
                        }`}
                      >
                        {modeConfig[mode].emoji} {modeConfig[mode].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Loading */}
              {soloLoading && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin text-4xl">🔄</div>
                  <p className="text-muted-foreground mt-2">{t.common.loading}</p>
                </div>
              )}

              {/* Solo Leaderboard Table */}
              {!soloLoading && (
                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-500" />
                      Top Streaks - {t.categories[soloCategory as keyof typeof t.categories]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {soloLeaderboard.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Flame className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Aucun record pour cette catégorie.</p>
                        <p className="text-sm mt-1">Sois le premier à établir un record !</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {soloLeaderboard.map((entry, idx) => (
                          <Link
                            key={entry.userId}
                            href={`/profile/${entry.userId}`}
                            className={`flex items-center gap-4 p-3 rounded-lg transition-all hover:bg-secondary/50 ${
                              entry.rank === 1
                                ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-400/50'
                                : entry.rank <= 3
                                  ? 'bg-secondary/50'
                                  : 'bg-secondary/20'
                            }`}
                          >
                            {/* Rank */}
                            <div className="w-10 flex justify-center">
                              {entry.rank === 1 && <Crown className="w-5 h-5 text-amber-400" />}
                              {entry.rank === 2 && <Medal className="w-5 h-5 text-gray-300" />}
                              {entry.rank === 3 && <Medal className="w-5 h-5 text-amber-600" />}
                              {entry.rank > 3 && <span className="text-muted-foreground font-mono">#{entry.rank}</span>}
                            </div>

                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center overflow-hidden">
                              {entry.userImage ? (
                                <img src={entry.userImage} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg">👤</span>
                              )}
                            </div>

                            {/* Name */}
                            <div className="flex-1">
                              <div className="font-medium">{entry.userName}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(entry.achievedAt).toLocaleDateString('fr-FR')}
                              </div>
                            </div>

                            {/* Streak */}
                            <div className="text-right">
                              <div className="font-bold text-lg flex items-center gap-1 text-orange-400">
                                🔥 {entry.bestStreak}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/50">
        <div className="container mx-auto flex items-center justify-center gap-4 text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            {t.common.home}
          </Link>
        </div>
      </footer>
    </div>
  );
}


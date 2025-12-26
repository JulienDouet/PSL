'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Medal, Crown, Flame } from 'lucide-react';
import Link from 'next/link';
import type { Category, SoloMode } from '@prisma/client';

// Mode configuration
const SOLO_MODES: Record<SoloMode, { label: string; emoji: string }> = {
  HARDCORE: { label: 'Hardcore', emoji: '💀' },
  CHALLENGE: { label: 'Challenge', emoji: '⚡' },
  NORMAL: { label: 'Normal', emoji: '🎯' }
};

const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: 'GP_FR', label: 'Grand Public FR', emoji: '🌍' },
  { key: 'MS_EN', label: 'Mainstream EN', emoji: '🌎' },
  { key: 'ANIME', label: 'Anime/Manga', emoji: '🎌' },
  { key: 'FLAGS', label: 'Drapeaux', emoji: '🚩' },
  { key: 'NOFILTER_FR', label: 'Sans Filtre FR', emoji: '🔞' },
  { key: 'NOFILTER_EN', label: 'No Filter EN', emoji: '🔞' },
];

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userImage: string | null;
  bestStreak: number;
  achievedAt: string;
}

export default function SoloLeaderboardPage() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('GP_FR');
  const [selectedMode, setSelectedMode] = useState<SoloMode>('NORMAL');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedCategory, selectedMode]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/solo/leaderboard?category=${selectedCategory}&mode=${selectedMode}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-amber-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-muted-foreground font-mono">#{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/solo">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="w-8 h-8 text-amber-400" />
              Classement Solo
            </h1>
            <p className="text-muted-foreground">Les meilleures streaks par catégorie et difficulté</p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Category Filter */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Catégorie</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === cat.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/50 hover:bg-secondary'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mode Filter */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Difficulté</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                {(Object.keys(SOLO_MODES) as SoloMode[]).map((mode) => {
                  const config = SOLO_MODES[mode];
                  return (
                    <button
                      key={mode}
                      onClick={() => setSelectedMode(mode)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedMode === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/50 hover:bg-secondary'
                      }`}
                    >
                      {config.emoji} {config.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Top Streaks - {CATEGORIES.find(c => c.key === selectedCategory)?.label} ({SOLO_MODES[selectedMode].label})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucun record pour cette catégorie.</p>
                <p className="text-sm mt-1">Sois le premier à établir un record !</p>
                <Link href="/solo">
                  <Button className="mt-4">
                    Jouer maintenant
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                      entry.rank === 1
                        ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-400/50'
                        : entry.rank <= 3
                          ? 'bg-secondary/50'
                          : 'bg-secondary/30'
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-10 flex justify-center">
                      {getRankIcon(entry.rank)}
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
                      <Link href={`/profile/${entry.userId}`} className="font-medium hover:text-primary transition-colors">
                        {entry.userName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {new Date(entry.achievedAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>

                    {/* Streak */}
                    <div className="text-right">
                      <div className="font-bold text-lg flex items-center gap-1">
                        🔥 {entry.bestStreak}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

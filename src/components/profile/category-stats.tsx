'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRankProgress } from "@/lib/mmr";
import { useTranslation } from "@/lib/i18n/context";
import { RivalriesTab } from "./rivalries-tab";

// Emojis pour les catégories
const CATEGORY_EMOJIS: Record<string, string> = {
  'GP_FR': '🍿',
  'MS_EN': '🍿',
  'ANIME': '🎌',
  'FLAGS': '🚩',
  'NOFILTER_FR': '🔥',
  'NOFILTER_EN': '🔥',
  'GP': '🌐',
  'NOFILTER': '🔥'
};

interface CategoryMMR {
  category: string;
  mmr: number;
  gamesPlayed: number;
  currentStreak: number;
  bestStreak: number;
  mmrPeak: number;
  wins: number;  // Pre-calculated server-side
}

interface MatchPlayer {
  id: string;
  placement: number | null;
  points: number | null;
  mmrChange: number | null;
  mmrAfter: number | null;
  match: {
    category: string;
    createdAt: string;
  };
}

interface CategoryStatsProps {
  userId: string;
  categoryMMRs: CategoryMMR[];
  matchPlayers: MatchPlayer[];
}

export function CategoryStats({ userId, categoryMMRs, matchPlayers }: CategoryStatsProps) {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'rivalries'>('stats');
  
  // Catégories avec des données - triées par parties jouées
  const categoriesWithData = categoryMMRs
    .filter(c => c.gamesPlayed > 0)
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed);

  // Sélectionner par défaut la catégorie la plus jouée, ou null si aucune
  const [activeCategory, setActiveCategory] = useState<string | null>(
    categoriesWithData.length > 0 ? categoriesWithData[0].category : null
  );

  // Si aucune catégorie, on affiche rien ou un message
  if (categoriesWithData.length === 0) {
    return (
      <Card className="bg-card border-border/50 text-center py-12">
        <CardContent>
          <div className="text-4xl mb-4">🎮</div>
          <h3 className="text-xl font-bold mb-2">{t.profile.no_ranked_games}</h3>
          <p className="text-muted-foreground">{t.profile.play_to_appear}</p>
        </CardContent>
      </Card>
    );
  }
  
  // Stats pour la catégorie active
  const activeStats = categoryMMRs.find(c => c.category === activeCategory) || categoriesWithData[0];
  
  const displayMMR = activeStats.mmr;
  const displayGames = activeStats.gamesPlayed;
  const mmrPeak = activeStats.mmrPeak;
  
  // Matchs filtrés par catégorie active
  const filteredMatches = matchPlayers.filter(mp => mp.match.category === activeCategory);

  // Utiliser les wins pré-calculés côté serveur
  const wins = activeStats.wins;
  const winRate = displayGames > 0 ? Math.round((wins / displayGames) * 100) : 0;

  // Rank progression
  const rankProgress = getRankProgress(displayMMR);

  // MMR History for chart (last 15 matches with mmrAfter, reversed to chronological order)
  const mmrHistory = filteredMatches
    .slice(0, 15)
    .filter(mp => mp.mmrAfter !== null)
    .map(mp => mp.mmrAfter as number)
    .reverse();

  return (
    <div className="space-y-4">
      {/* Onglets de catégorie */}
      <div className="flex flex-wrap gap-2">
        {categoriesWithData.map(cat => {
          const emoji = CATEGORY_EMOJIS[cat.category] || '🎮';
          // @ts-ignore
          const label = t.categories[cat.category] || cat.category;
          
          return (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeCategory === cat.category 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {emoji} {label}
              <span className="ml-2 text-xs opacity-70">({cat.mmr})</span>
            </button>
          );
        })}
      </div>

      {/* Sous-onglets Stats / Rivalités */}
      <div className="flex gap-2 border-b border-border/50 pb-2">
        <button
          onClick={() => setActiveSubTab('stats')}
          className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg ${
            activeSubTab === 'stats'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          📊 {t.profile?.stats || 'Stats'}
        </button>
        <button
          onClick={() => setActiveSubTab('rivalries')}
          className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg ${
            activeSubTab === 'rivalries'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          🤝 {t.rivalries?.title || 'Rivalités'}
        </button>
      </div>

      {/* Contenu selon le sous-onglet actif */}
      {activeSubTab === 'rivalries' ? (
        <RivalriesTab userId={userId} category={activeCategory || undefined} />
      ) : (
        <>

      {/* Stats principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-gradient">{displayMMR}</div>
            <div className="text-sm text-muted-foreground">MMR</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{displayGames}</div>
            <div className="text-sm text-muted-foreground">{t.profile.games_played}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-green-400">{wins}</div>
            <div className="text-sm text-muted-foreground">{t.profile.wins}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="pt-6 text-center">
            <div className={`text-3xl font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
              {winRate}%
            </div>
            <div className="text-sm text-muted-foreground">{t.profile.winrate}</div>
          </CardContent>
        </Card>
      </div>

      {/* MMR Peak + Rank Progress + Chart */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* MMR Peak & Rank Progress */}
        <Card className="bg-card border-border/50">
          <CardContent className="pt-6 space-y-4">
            {/* MMR Peak */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">🏔️ {t.profile?.mmr_peak || 'MMR Peak'}</span>
              <span className="text-xl font-bold" style={{ color: getRankProgress(mmrPeak).currentRank.color }}>
                {mmrPeak}
              </span>
            </div>

            {/* Rank Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5" style={{ color: rankProgress.currentRank.color }}>
                  <span>{rankProgress.currentRank.icon}</span>
                  <span>{rankProgress.currentRank.displayName}</span>
                </div>
                {rankProgress.nextRank && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>{rankProgress.nextRank.icon}</span>
                    <span>{rankProgress.nextRank.displayName}</span>
                  </div>
                )}
              </div>
              
              {/* Progress bar */}
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ 
                    width: `${rankProgress.progress * 100}%`,
                    backgroundColor: rankProgress.currentRank.color
                  }}
                />
              </div>

              {/* Remaining text */}
              {rankProgress.nextRank && (
                <div className="text-xs text-muted-foreground text-center">
                  {rankProgress.remaining} MMR → {rankProgress.nextRank.displayName}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MMR Chart */}
        <Card className="bg-card border-border/50">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-3">📈 {t.profile?.mmr_evolution || 'Évolution MMR'}</div>
            {mmrHistory.length >= 2 ? (
              <MiniMmrChart data={mmrHistory} color={rankProgress.currentRank.color} />
            ) : (
              <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
                {t.profile?.not_enough_data || 'Pas assez de données'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historique des matchs filtrés */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle>
            {t.profile.recent_matches_category.replace('{category}', 
              activeCategory 
                // @ts-ignore
                ? (t.categories[activeCategory] || activeCategory) 
                : ''
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">🎮</div>
              <p>{t.profile.no_matches_category}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMatches.slice(0, 10).map((mp) => {
                const emoji = CATEGORY_EMOJIS[mp.match.category] || '🎮';
                return (
                  <div
                    key={mp.id}
                    className="p-3 rounded-lg bg-secondary/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{emoji}</span>
                      <span className={mp.placement === 1 ? "text-green-400 font-bold" : "text-muted-foreground"}>
                        {mp.placement === 1 ? t.dashboard.placement.first : t.dashboard.placement.other.replace('{n}', String(mp.placement))}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {mp.points} {t.common.pts}
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
        </>
      )}
    </div>
  );
}

// Mini SVG Chart component
function MiniMmrChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const width = 100;
  const height = 60;
  const padding = 5;
  
  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  // Create area path
  const firstX = padding;
  const lastX = padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2);
  const areaPath = `M ${firstX},${height - padding} L ${points} L ${lastX},${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
      {/* Area fill */}
      <path
        d={areaPath}
        fill={`${color}20`}
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End point */}
      <circle
        cx={padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)}
        cy={height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}
        r="3"
        fill={color}
      />
    </svg>
  );
}


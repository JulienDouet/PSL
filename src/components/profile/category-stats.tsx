'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRankProgress } from "@/lib/mmr";
import { useTranslation } from "@/lib/i18n/context";

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
  // ... other fields
}

interface MatchPlayer {
  id: string;
  placement: number | null;
  points: number | null;
  mmrChange: number | null;
  match: {
    category: string;
    createdAt: string;
  };
}

interface CategoryStatsProps {
  categoryMMRs: CategoryMMR[];
  matchPlayers: MatchPlayer[];
  globalMMR: number;
  globalGamesPlayed: number;
}

export function CategoryStats({ categoryMMRs, matchPlayers, globalMMR, globalGamesPlayed }: CategoryStatsProps) {
  const { t } = useTranslation();
  
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
  
  // Stats pour la catégorie active (garantie d'exister ici sauf bug)
  const activeStats = categoryMMRs.find(c => c.category === activeCategory) || categoriesWithData[0];
  
  const displayMMR = activeStats.mmr;
  const displayGames = activeStats.gamesPlayed;
  
  // Matchs filtrés par catégorie active
  const filteredMatches = matchPlayers.filter(mp => mp.match.category === activeCategory);

  // Calculer stats
  const wins = filteredMatches.filter(mp => mp.placement === 1).length;
  const losses = displayGames - wins;
  const winRate = displayGames > 0 ? Math.round((wins / displayGames) * 100) : 0;

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

      {/* Stats pour la catégorie sélectionnée */}
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
    </div>
  );
}

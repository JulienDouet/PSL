'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRankProgress } from "@/lib/mmr";

// Labels et emojis pour les catégories
const CATEGORY_INFO: Record<string, { label: string; emoji: string }> = {
  'GP_FR': { label: 'GP FR', emoji: '🇫🇷' },
  'MS_EN': { label: 'MS EN', emoji: '🇬🇧' },
  'ANIME': { label: 'Anime', emoji: '🎌' },
  'FLAGS': { label: 'Drapeaux', emoji: '🚩' },
  'NOFILTER_FR': { label: 'Sans Filtre', emoji: '🔥' },
  'NOFILTER_EN': { label: 'No Filter', emoji: '💥' },
  // Anciennes catégories
  'GP': { label: 'GP', emoji: '🌐' },
  'NOFILTER': { label: 'Sans Filtre', emoji: '🔥' }
};

interface CategoryMMR {
  category: string;
  mmr: number;
  gamesPlayed: number;
}

export function DashboardCategoryMMR() {
  const [categoryMMRs, setCategoryMMRs] = useState<CategoryMMR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategoryMMRs() {
      try {
        const res = await fetch('/api/user/category-mmr');
        if (res.ok) {
          const data = await res.json();
          setCategoryMMRs(data.categoryMMRs || []);
        }
      } catch (err) {
        console.error('Error fetching category MMRs:', err);
      }
      setLoading(false);
    }
    fetchCategoryMMRs();
  }, []);

  // Filtrer les catégories avec des parties jouées
  const categoriesWithData = categoryMMRs.filter(c => c.gamesPlayed > 0);

  if (loading) {
    return (
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle>🎯 MMR par mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (categoriesWithData.length === 0) {
    return (
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle>🎯 MMR par mode</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-2">
            Joue des parties pour voir ton MMR par mode !
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle>🎯 MMR par mode</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {categoriesWithData.map(cat => {
            const info = CATEGORY_INFO[cat.category] || { label: cat.category, emoji: '🎮' };
            const rankInfo = getRankProgress(cat.mmr);
            return (
              <div 
                key={cat.category}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{info.emoji}</span>
                  <div>
                    <div className="font-medium">{info.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {cat.gamesPlayed} partie{cat.gamesPlayed > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gradient">{cat.mmr}</div>
                  <div className="text-xs" style={{ color: rankInfo.currentRank.color }}>
                    {rankInfo.currentRank.icon} {rankInfo.currentRank.displayName}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

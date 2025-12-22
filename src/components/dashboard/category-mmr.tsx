'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRankProgress } from "@/lib/mmr";
import { useTranslation } from "@/lib/i18n/context";
import { useDashboardRefresh } from '@/lib/dashboard-context';

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
}

export function DashboardCategoryMMR() {
  const [categoryMMRs, setCategoryMMRs] = useState<CategoryMMR[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { refreshKey } = useDashboardRefresh();

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
  }, [refreshKey]); // Re-fetch quand refreshKey change

  // Filtrer les catégories avec des parties jouées
  const categoriesWithData = categoryMMRs.filter(c => c.gamesPlayed > 0);

  if (loading) {
    return (
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle>{t.dashboard.category_mmr.title}</CardTitle>
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
          <CardTitle>{t.dashboard.category_mmr.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-2">
            {t.dashboard.category_mmr.unranked}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle>{t.dashboard.category_mmr.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {categoriesWithData.map(cat => {
            const emoji = CATEGORY_EMOJIS[cat.category] || '🎮';
            // @ts-ignore
            const label = t.categories[cat.category] || cat.category;
            const rankInfo = getRankProgress(cat.mmr);
            return (
              <div 
                key={cat.category}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{emoji}</span>
                  <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.dashboard.category_mmr.games.replace('{count}', String(cat.gamesPlayed))}
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


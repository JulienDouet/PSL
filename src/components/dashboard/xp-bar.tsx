'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { getRankProgress, RANKS } from "@/lib/mmr";
import { useDashboardRefresh } from '@/lib/dashboard-context';

interface CategoryMMR {
  category: string;
  mmr: number;
  gamesPlayed: number;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  'GP_FR': '🍿',
  'MS_EN': '🍿',
  'ANIME': '🎌',
  'FLAGS': '🚩',
  'NOFILTER_FR': '🔥',
  'NOFILTER_EN': '🔥',
};

const CATEGORY_LABELS: Record<string, string> = {
  'GP_FR': 'Grand Public [FR]',
  'MS_EN': 'Grand Public [EN]',
  'ANIME': 'Anime',
  'FLAGS': 'Drapeaux',
  'NOFILTER_FR': 'Sans Filtre [FR]',
  'NOFILTER_EN': 'Sans Filtre [EN]',
};

export function XPBar() {
  const [categoryMMRs, setCategoryMMRs] = useState<CategoryMMR[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const { refreshKey } = useDashboardRefresh();

  useEffect(() => {
    async function fetchMMR() {
      try {
        const res = await fetch('/api/user/category-mmr');
        if (res.ok) {
          const data = await res.json();
          const categories = (data.categoryMMRs || []).filter((c: CategoryMMR) => c.gamesPlayed > 0);
          setCategoryMMRs(categories);
          
          // Sélectionner la catégorie la plus jouée par défaut
          if (categories.length > 0 && !selectedCategory) {
            const sorted = [...categories].sort((a: CategoryMMR, b: CategoryMMR) => b.gamesPlayed - a.gamesPlayed);
            setSelectedCategory(sorted[0].category);
          }
        }
      } catch (err) {
        console.error('Error fetching MMR:', err);
      }
      setLoading(false);
    }
    fetchMMR();
  }, [refreshKey]);

  // Animation de la barre de progression
  const currentData = categoryMMRs.find(c => c.category === selectedCategory);
  const mmr = currentData?.mmr ?? 1000;

  useEffect(() => {
    const rankInfo = getRankProgress(mmr);
    const targetProgress = rankInfo.progress * 100;
    setAnimatedProgress(0);
    const timer = setTimeout(() => {
      setAnimatedProgress(targetProgress);
    }, 100);
    return () => clearTimeout(timer);
  }, [mmr, selectedCategory]);

  if (loading) {
    return (
      <Card className="bg-card border-border/50 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si aucune catégorie jouée
  if (categoryMMRs.length === 0) {
    return (
      <Card className="bg-card border-border/50 overflow-hidden">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Joue ta première partie pour voir ta progression !</p>
        </CardContent>
      </Card>
    );
  }

  const rankInfo = getRankProgress(mmr);
  const { currentRank, nextRank, remaining } = rankInfo;
  const isMaxRank = !nextRank;
  const categoryEmoji = CATEGORY_EMOJIS[selectedCategory || ''] || '🎮';
  const categoryLabel = CATEGORY_LABELS[selectedCategory || ''] || selectedCategory;

  return (
    <Card className="bg-card border-border/50 overflow-hidden relative group">
      <div 
        className="absolute inset-0 opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-30"
        style={{ background: `radial-gradient(ellipse at center, ${currentRank.color} 0%, transparent 70%)` }}
      />
      
      <CardContent className="p-6 relative">
        {/* Sélecteur de catégorie */}
        {categoryMMRs.length > 1 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {categoryMMRs.map(cat => (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory === cat.category
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {CATEGORY_EMOJIS[cat.category] || '🎮'} {cat.gamesPlayed}
              </button>
            ))}
          </div>
        )}

        {/* Header avec rang et MMR */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="relative flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 group-hover:scale-110"
              style={{ 
                background: `linear-gradient(135deg, ${currentRank.color}40 0%, ${currentRank.color}10 100%)`,
                boxShadow: `0 0 20px ${currentRank.color}40`
              }}
            >
              <span className="text-3xl animate-float" style={{ animationDuration: '3s' }}>
                {currentRank.icon}
              </span>
              <div 
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: currentRank.color }}
              />
            </div>
            
            <div>
              <div className="text-xl font-bold" style={{ color: currentRank.color }}>
                {currentRank.displayName}
              </div>
              <div className="text-muted-foreground text-sm flex items-center gap-1">
                <span>{categoryEmoji}</span>
                <span>{categoryLabel}</span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-gradient">{mmr}</div>
            <div className="text-sm text-muted-foreground">MMR</div>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="relative">
          <div className="h-4 rounded-full bg-secondary/50 overflow-hidden relative">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
              style={{ 
                width: `${animatedProgress}%`,
                background: isMaxRank 
                  ? `linear-gradient(90deg, ${currentRank.color} 0%, #FFD700 50%, ${currentRank.color} 100%)`
                  : `linear-gradient(90deg, ${currentRank.color}80 0%, ${currentRank.color} 100%)`
              }}
            >
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  animation: 'shimmer 2s infinite'
                }}
              />
            </div>
            <div 
              className="absolute bottom-0 h-2 blur-sm transition-all duration-1000"
              style={{ width: `${animatedProgress}%`, backgroundColor: currentRank.color, opacity: 0.6 }}
            />
          </div>
          
          <div className="flex justify-between mt-3">
            <div className="flex items-center gap-1">
              <span className="text-lg">{currentRank.icon}</span>
              <span className="text-xs font-medium" style={{ color: currentRank.color }}>{currentRank.min}</span>
            </div>
            
            {nextRank ? (
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium" style={{ color: nextRank.color }}>{nextRank.min}</span>
                <span className="text-lg">{nextRank.icon}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-amber-400">MAX</span>
                <span className="text-lg">👑</span>
              </div>
            )}
          </div>
        </div>

        {/* Message de progression */}
        <div className="mt-4 text-center">
          {isMaxRank ? (
            <div className="text-sm">
              <span className="text-amber-400 font-semibold">🏆 Rang Maximum Atteint !</span>
              <p className="text-muted-foreground text-xs mt-1">Tu fais partie de l&apos;élite PSL</p>
            </div>
          ) : (
            <div className="text-sm">
              <span className="font-semibold" style={{ color: nextRank.color }}>{remaining} MMR</span>
              <span className="text-muted-foreground"> pour </span>
              <span className="font-semibold" style={{ color: nextRank.color }}>{nextRank.icon} {nextRank.displayName}</span>
            </div>
          )}
        </div>

        {/* Preview des rangs suivants */}
        {!isMaxRank && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <div className="flex justify-center gap-3">
              {RANKS.slice(RANKS.findIndex(r => r.name === currentRank.name)).slice(0, 4).map((rank, idx) => (
                <div 
                  key={rank.name}
                  className={`flex flex-col items-center transition-all duration-300 ${idx === 0 ? 'scale-110' : 'opacity-50 hover:opacity-80'}`}
                >
                  <span className={`text-xl ${idx === 0 ? 'animate-bounce' : ''}`} style={{ animationDuration: '2s' }}>
                    {rank.icon}
                  </span>
                  <span className="text-xs mt-1" style={{ color: rank.color }}>{rank.min}+</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


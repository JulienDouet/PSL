"use client";

import { useTranslation } from "@/lib/i18n/context";
import { Card, CardContent } from "@/components/ui/card";
import { getRankProgress } from "@/lib/mmr";

interface ProfileHeaderProps {
  displayName: string;
  image: string | null;
  createdAt: string;
  totalPlayTimeSeconds: number;
  bestCategory: {
    category: string;
    mmr: number;
    currentStreak: number;
    bestStreak: number;
  } | null;
}

export function ProfileHeader({ 
  displayName, 
  image, 
  createdAt, 
  totalPlayTimeSeconds,
  bestCategory 
}: ProfileHeaderProps) {
  const { t } = useTranslation();

  // Format member since date
  const memberSinceDate = new Date(createdAt);
  const formattedDate = memberSinceDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Format play time
  const formatPlayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h${minutes > 0 ? `${minutes}m` : ''}`;
    }
    return `${minutes}m`;
  };

  // Get rank info if best category exists
  const rankProgress = bestCategory ? getRankProgress(bestCategory.mmr) : null;

  return (
    <Card className="bg-card border-border/50 card-glow mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl sm:text-4xl border-2 border-primary/30 overflow-hidden flex-shrink-0">
            {image ? (
              <img src={image} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              displayName[0]?.toUpperCase() || "?"
            )}
          </div>

          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">
                <span className="text-gradient">{displayName}</span>
              </h1>
              
              {/* Rank Badge */}
              {rankProgress && (
                <div 
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold w-fit"
                  style={{ 
                    backgroundColor: `${rankProgress.currentRank.color}20`,
                    color: rankProgress.currentRank.color,
                    border: `1px solid ${rankProgress.currentRank.color}40`
                  }}
                >
                  <span>{rankProgress.currentRank.icon}</span>
                  <span>{rankProgress.currentRank.displayName}</span>
                  <span className="opacity-70">({bestCategory?.mmr})</span>
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {/* Streak */}
              {bestCategory && bestCategory.currentStreak > 0 && (
                <span className="text-amber-400">
                  🔥 {t.profile?.streak || 'Streak'}: {bestCategory.currentStreak}
                  {bestCategory.bestStreak > bestCategory.currentStreak && (
                    <span className="opacity-70"> (max: {bestCategory.bestStreak})</span>
                  )}
                </span>
              )}
              
              {/* Best streak when no current streak */}
              {bestCategory && bestCategory.currentStreak === 0 && bestCategory.bestStreak > 0 && (
                <span className="text-muted-foreground">
                  🏆 {t.profile?.best_streak || 'Best streak'}: {bestCategory.bestStreak}
                </span>
              )}

              {/* Time Played */}
              {totalPlayTimeSeconds > 0 && (
                <span>
                  ⏱️ {formatPlayTime(totalPlayTimeSeconds)} {t.profile?.played || 'joué'}
                </span>
              )}

              {/* Member Since */}
              <span>
                📅 {t.profile?.member_since || 'Membre depuis'} {formattedDate}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface MatchPlayer {
  id: string;
  placement: number | null;
  points: number | null;
  mmrChange: number | null;
  match: {
    category: string;
  };
}

interface DashboardClientProps {
  displayName: string;
  userId: string;
  recentMatches: MatchPlayer[]; // Initial data from server
}

export function DashboardClient({ displayName, userId, recentMatches: initialMatches }: DashboardClientProps) {
  const { t } = useTranslation();
  const { refreshKey } = useDashboardRefresh();
  const [recentMatches, setRecentMatches] = useState<MatchPlayer[]>(initialMatches);

  // Re-fetch matches when refreshKey changes (after a match ends)
  useEffect(() => {
    if (refreshKey === 0) return; // Skip initial render
    
    async function fetchMatches() {
      try {
        const res = await fetch('/api/user/recent-matches');
        if (res.ok) {
          const data = await res.json();
          setRecentMatches(data.matches || []);
        }
      } catch (err) {
        console.error('Error fetching recent matches:', err);
      }
    }
    fetchMatches();
  }, [refreshKey]);

  return (
    <>
      {/* Player Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {t.dashboard.welcome.replace('{name}', '')} <span className="text-gradient">{displayName}</span> !
        </h1>
        <p className="text-muted-foreground">
          {t.dashboard.welcome_back}
        </p>
      </div>

      {/* Recent Matches Card */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle>{t.dashboard.recent_matches}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">🎮</div>
              <p>{t.dashboard.no_matches}</p>
              <p className="text-sm">{t.dashboard.first_match}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentMatches.map((mp) => {
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
  );
}

export function DashboardDiscordCard() {
  const { t } = useTranslation();
  
  return (
    <Card className="bg-[#5865F2]/10 border-[#5865F2]/20">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="bg-[#5865F2] text-white p-2 rounded-full shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.942 5.556a16.299 16.299 0 0 0-4.126-1.297c-.178.321-.385.754-.529 1.097a15.08 15.08 0 0 0-4.575 0 2.44 2.44 0 0 0-.533-1.097A16.288 16.288 0 0 0 5.055 5.556a16.097 16.097 0 0 0-3.078 12.012 16.155 16.155 0 0 0 4.978 2.503 12.028 12.028 0 0 0 1.077-1.776 10.74 10.74 0 0 1-1.579-.753.868.868 0 0 1 .159-.395c3.153 1.458 6.57 1.458 9.684 0 .052.138.106.27.163.4.455.24.914.475 1.385.717a12.163 12.163 0 0 0 1.282 1.803 16.134 16.134 0 0 0 4.97-2.5 16.103 16.103 0 0 0-3.069-12.012zM8.618 13.905c-1.124 0-2.052-1.036-2.052-2.304 0-1.268.914-2.304 2.052-2.304 1.151 0 2.079 1.036 2.079 2.304 0 1.268-.914 2.304-2.079 2.304zm6.756 0c-1.124 0-2.052-1.036-2.052-2.304 0-1.268.914-2.304 2.052-2.304 1.151 0 2.079 1.036 2.079 2.304 0 1.268-.928 2.304-2.079 2.304z" fill="currentColor"/>
          </svg>
        </div>
        <div className="text-sm">
          {t.dashboard.discord_notif.split('Discord').map((part, i, arr) => 
            i === arr.length - 1 ? part : (
              <span key={i}>
                {part}
                <a href="https://discord.gg/JGHRNy6qRn" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5865F2] hover:underline">Discord</a>
              </span>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardShortcuts({ userId }: { userId: string }) {
  const { t } = useTranslation();
  
  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle>{t.dashboard.shortcuts}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link href="/leaderboard" className="block">
          <Button variant="outline" className="w-full justify-start">
            {t.dashboard.shortcut_leaderboard}
          </Button>
        </Link>
        <Link href={`/profile/${userId}`} className="block">
          <Button variant="outline" className="w-full justify-start">
            {t.dashboard.shortcut_profile}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

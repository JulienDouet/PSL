'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/context";

interface Opponent {
  id: string;
  name: string;
  image: string | null;
}

interface Matchup {
  id: string;
  category: string;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
  lastPlayed: string;
  opponent: Opponent;
}

interface RivalriesData {
  matchups: Matchup[];
  nemesis: Matchup | null;
  prey: Matchup | null;
  totalOpponents: number;
  qualifiedOpponents: number;
}

interface RivalriesTabProps {
  userId: string;
  category?: string;
}

export function RivalriesTab({ userId, category }: RivalriesTabProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<RivalriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRivalries() {
      try {
        setLoading(true);
        const url = `/api/user/${userId}/rivalries${category ? `?category=${category}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError('Failed to load rivalries');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchRivalries();
  }, [userId, category]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {error || 'No data available'}
      </div>
    );
  }

  if (data.matchups.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <span className="text-4xl mb-4 block">🤝</span>
        <p>{t.rivalries?.no_data || 'No rivalries yet. Play more ranked matches!'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nemesis & Prey Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nemesis Card */}
        <Card className={`bg-gradient-to-br from-red-500/10 to-red-900/20 border-red-500/30 ${!data.nemesis ? 'opacity-50' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl">😈</div>
              <div className="flex-1">
                <p className="text-xs text-red-400 uppercase tracking-wide font-semibold mb-1">
                  {t.rivalries?.nemesis || 'Nemesis'}
                </p>
                {data.nemesis ? (
                  <>
                    <div className="flex items-center gap-2">
                      {data.nemesis.opponent.image && (
                        <img 
                          src={data.nemesis.opponent.image} 
                          alt="" 
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <span className="font-bold text-lg">{data.nemesis.opponent.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="text-green-400">{data.nemesis.wins}W</span>
                      {' - '}
                      <span className="text-red-400">{data.nemesis.losses}L</span>
                      <span className="ml-2 opacity-70">
                        ({Math.round(data.nemesis.winRate * 100)}%)
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.rivalries?.need_more_games || 'Need 3+ games vs same opponent'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prey Card */}
        <Card className={`bg-gradient-to-br from-green-500/10 to-green-900/20 border-green-500/30 ${!data.prey ? 'opacity-50' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🎯</div>
              <div className="flex-1">
                <p className="text-xs text-green-400 uppercase tracking-wide font-semibold mb-1">
                  {t.rivalries?.prey || 'Favorite Prey'}
                </p>
                {data.prey && data.prey.id !== data.nemesis?.id ? (
                  <>
                    <div className="flex items-center gap-2">
                      {data.prey.opponent.image && (
                        <img 
                          src={data.prey.opponent.image} 
                          alt="" 
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <span className="font-bold text-lg">{data.prey.opponent.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="text-green-400">{data.prey.wins}W</span>
                      {' - '}
                      <span className="text-red-400">{data.prey.losses}L</span>
                      <span className="ml-2 opacity-70">
                        ({Math.round(data.prey.winRate * 100)}%)
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.rivalries?.need_more_games || 'Need 3+ games vs same opponent'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Opponents List */}
      <Card className="bg-card border-border/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>🤝</span>
            {t.rivalries?.all_opponents || 'All Opponents'}
            <span className="text-sm text-muted-foreground font-normal">
              ({data.totalOpponents})
            </span>
          </h3>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.matchups.map((matchup) => (
              <div 
                key={matchup.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm overflow-hidden">
                    {matchup.opponent.image ? (
                      <img src={matchup.opponent.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      matchup.opponent.name[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <span className="font-medium">{matchup.opponent.name}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="text-green-400">{matchup.wins}W</span>
                    {' - '}
                    <span className="text-red-400">{matchup.losses}L</span>
                  </div>
                  
                  {/* Win rate bar */}
                  <div className="w-16 h-2 bg-red-500/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${matchup.winRate * 100}%` }}
                    />
                  </div>
                  
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {Math.round(matchup.winRate * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

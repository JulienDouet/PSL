'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { useTranslation } from "@/lib/i18n/context";

interface MatchPlayer {
  nickname: string;
  mmr: number;
}

interface ActiveMatch {
  roomCode: string;
  category: string;
  playerCount: number;
  players: MatchPlayer[];
  createdAt: string;
  durationSeconds: number;
  botPid?: number;
}

interface RecentMatchPlayer {
  id: string | null;
  nickname: string;
  placement: number;
  mmrChange: number;
  mmrBefore: number;
  score: number;
}

interface RecentMatch {
  id: string;
  roomCode: string;
  category: string;
  playerCount: number;
  endedAt: string;
  durationSeconds: number;
  avgMmr: number;
  mmrSpread: number;
  isUpset: boolean;
  winnerStreak: number;
  players: RecentMatchPlayer[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function MatchesPage() {
  const [activeTab, setActiveTab] = useState<'live' | 'recent'>('live');
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null); // store roomCode or matchId
  const [killing, setKilling] = useState<string | null>(null);
  
  const { t } = useTranslation();

  // Category label dynamique
  const getCategoryLabel = (category: string): string => {
    const emoji: Record<string, string> = {
      'GP_FR': '🍿',
      'MS_EN': '🍿',
      'ANIME': '🎌',
      'FLAGS': '🚩',
      'NOFILTER_FR': '🔥',
      'NOFILTER_EN': '🔥'
    };
    // @ts-ignore
    const catLabel = t.categories[category] || category;
    return `${emoji[category] || '🎮'} ${catLabel}`;
  };

  const fetchActiveMatches = async () => {
    try {
      const res = await fetch('/api/matches/active');
      if (res.ok) {
        const data = await res.json();
        setActiveMatches(data.matches || []);
        setIsAdmin(data.isAdmin || false);
      }
    } catch (err) {
      console.error('Error fetching active matches:', err);
    }
  };

  const fetchRecentMatches = async () => {
    try {
      const res = await fetch('/api/matches/recent');
      if (res.ok) {
        const data = await res.json();
        setRecentMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching recent matches:', err);
    }
  };

  // Initial fetch based on tab
  useEffect(() => {
    setLoading(true);
    if (activeTab === 'live') {
      fetchActiveMatches().then(() => setLoading(false));
      const interval = setInterval(fetchActiveMatches, 15000); // 15s au lieu de 5s
      return () => clearInterval(interval);
    } else {
      fetchRecentMatches().then(() => setLoading(false));
    }
  }, [activeTab]);

  const handleKill = async (roomCode: string) => {
    if (!confirm(t.matches.confirm_end.replace('{room}', roomCode))) {
      return;
    }
    
    setKilling(roomCode);
    try {
      const res = await fetch('/api/matches/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode })
      });
      
      if (res.ok) {
        await fetchActiveMatches();
      } else {
        const data = await res.json();
        alert(data.error || t.matches.error_delete);
      }
    } catch (err) {
      console.error('Error killing match:', err);
      alert(t.matches.error_delete);
    }
    setKilling(null);
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">
              🎮 <span className="text-gradient">{t.matches.live_title}</span>
            </h1>
            
            {/* Tabs */}
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={() => setActiveTab('live')}
                className={`px-6 py-2 rounded-full font-bold transition-all ${
                  activeTab === 'live'
                    ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                🔴 En cours
                {activeMatches.length > 0 && <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">{activeMatches.length}</span>}
              </button>
              <button
                onClick={() => setActiveTab('recent')}
                className={`px-6 py-2 rounded-full font-bold transition-all ${
                  activeTab === 'recent'
                    ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                🕒 Terminées
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
             <div className="text-center py-12">
               <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
               <p className="mt-4 text-muted-foreground">{t.common.loading}</p>
             </div>
          ) : activeTab === 'live' ? (
            /* LIVE MATCHES VIEW */
            activeMatches.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-12 text-center">
                  <p className="text-xl text-muted-foreground">{t.matches.live_no_ranked}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t.matches.live_will_appear}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {activeMatches.map((match) => (
                  <Card 
                    key={match.roomCode} 
                    className="glass-card overflow-hidden transition-all duration-200 hover:border-primary/50"
                  >
                    <CardHeader 
                      className="cursor-pointer"
                      onClick={() => setExpandedMatch(expandedMatch === match.roomCode ? null : match.roomCode)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-mono font-bold text-primary">
                            {match.roomCode}
                          </span>
                          <span className="px-3 py-1 bg-primary/20 rounded-full text-sm">
                            {getCategoryLabel(match.category)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">
                              {match.playerCount} {t.matches.live_players}
                            </div>
                            <div className="text-xs text-muted-foreground/70">
                              ⏱️ {formatDuration(match.durationSeconds)}
                            </div>
                          </div>
                          
                          <span className={`transition-transform duration-200 ${expandedMatch === match.roomCode ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    {expandedMatch === match.roomCode && (
                      <CardContent className="border-t border-border/50 pt-4">
                        <div className="space-y-3">
                          <div className="grid gap-2">
                            {match.players.map((player, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-background/30 rounded-lg px-4 py-2">
                                <span>{player.nickname}</span>
                                <span className="text-sm text-muted-foreground">
                                  {player.mmr} MMR
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-border/30">
                            <a 
                              href={`https://jklm.fun/${match.roomCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                            >
                              🔗 {t.matches.view_on_jklm}
                            </a>

                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleKill(match.roomCode);
                                }}
                                disabled={killing === match.roomCode}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                {killing === match.roomCode ? `⏳ ${t.matches.stopping}` : `🛑 ${t.matches.end_match}`}
                              </button>
                            )}
                          </div>
                          
                          {isAdmin && match.botPid && (
                            <div className="text-xs text-muted-foreground/50 pt-2">
                                Bot PID: {match.botPid}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )
          ) : (
            /* RECENT MATCHES VIEW */
            recentMatches.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Aucune partie terminée récemment.</p>
                  </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                {recentMatches.map((match) => (
                  <Card 
                    key={match.id} 
                    className="glass-card overflow-hidden transition-all duration-200 hover:border-border"
                  >
                    <CardHeader 
                      className="cursor-pointer"
                      onClick={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center justify-between w-full sm:w-auto">
                            <div className="flex items-center gap-3">
                                <span className="text-lg sm:text-xl text-muted-foreground whitespace-nowrap">
                                    {formatTimeAgo(match.endedAt)}
                                </span>
                                <span className="px-3 py-1 bg-secondary rounded-full text-xs sm:text-sm whitespace-nowrap">
                                    {getCategoryLabel(match.category)}
                                </span>
                            </div>
                            
                            {/* Mobile arrow */}
                            <span className={`sm:hidden transition-transform duration-200 ${expandedMatch === match.id ? 'rotate-180' : ''} p-2`}>
                                ▼
                            </span>
                        </div>
                        
                        <div className="flex items-center justify-between w-full sm:w-auto sm:gap-4">
                            {/* Winner + badges */}
                            <div className="flex items-center gap-2 max-w-[70%] sm:max-w-none flex-wrap">
                                <span className="text-xl">🏆</span>
                                <span className="font-bold text-amber-400 truncate">
                                    {match.players.find(p => p.placement === 1)?.nickname || 'Unknown'}
                                </span>
                                {/* Upset badge */}
                                {match.isUpset && (
                                  <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs font-medium">
                                    ⚡ Upset!
                                  </span>
                                )}
                                {/* Streak badge */}
                                {match.winnerStreak >= 2 && (
                                  <span className="text-amber-400 text-xs">
                                    🔥 {match.winnerStreak}
                                  </span>
                                )}
                            </div>

                          <div className="text-right hidden sm:block whitespace-nowrap">
                            <div className="text-sm text-muted-foreground">
                              {match.playerCount} Joueurs • Ø{match.avgMmr}
                            </div>
                            <div className="text-xs text-muted-foreground/70">
                              ⏱️ {formatDuration(match.durationSeconds)} • ±{match.mmrSpread} MMR
                            </div>
                          </div>
                          
                          {/* Desktop arrow */}
                          <span className={`hidden sm:inline-block transition-transform duration-200 ${expandedMatch === match.id ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    {expandedMatch === match.id && (
                      <CardContent className="border-t border-border/50 pt-4">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                            Classement
                          </h4>
                          <div className="grid gap-2">
                            {match.players.map((player) => (
                              <div 
                                key={player.id || player.nickname} 
                                className={`flex items-center justify-between rounded-lg px-3 py-2 sm:px-4 ${
                                    player.placement === 1 ? 'bg-amber-400/10 border border-amber-400/20' : 'bg-background/30'
                                }`}
                              >
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    <span className="font-mono text-muted-foreground w-5 sm:w-6 flex-shrink-0 text-sm sm:text-base">#{player.placement}</span>
                                    <span className={`truncate text-sm sm:text-base ${player.placement === 1 ? 'font-bold text-amber-400' : ''}`}>
                                        {player.nickname}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                                    <span className="text-xs sm:text-sm text-muted-foreground">{player.score} pts</span>
                                    <span className={`text-xs sm:text-sm ${player.mmrChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {player.mmrChange > 0 ? '+' : ''}{player.mmrChange} MMR
                                    </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<ActiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
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

  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/matches/active');
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        setIsAdmin(data.isAdmin || false);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 5000);
    return () => clearInterval(interval);
  }, []);

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
        await fetchMatches();
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
            <p className="text-muted-foreground">
              {matches.length === 0 
                ? t.matches.live_none 
                : t.matches.live_count.replace('{n}', String(matches.length))}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">{t.matches.live_loading}</p>
            </div>
          ) : matches.length === 0 ? (
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
              {matches.map((match) => (
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
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                          {t.matches.players_label}
                        </h4>
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
          )}
        </div>
      </main>
    </div>
  );
}


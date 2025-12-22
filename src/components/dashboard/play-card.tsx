'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Check, Users, X, ChevronDown, Crown, Target, Flame, Scale } from 'lucide-react';
import { GAME_MODE_LIST, DEFAULT_MODE, getGameMode, type GameModeKey } from '@/lib/game-modes';
import { useTranslation } from "@/lib/i18n/context";
import { useDashboardRefresh } from '@/lib/dashboard-context';

// 4 états : idle → searching → found → lobby
type QueueMode = 'idle' | 'searching' | 'found' | 'lobby';

interface EnrichedPlayer {
  nickname: string;
  mmr: number;
  gamesPlayed: number;
  winrate: number;
  rank: number;
  isTopRanked: boolean;
}

interface MatchInfo {
  roomCode: string;
  players: EnrichedPlayer[];
  category: string;
}

export function PlayCard() {
  const [mode, setMode] = useState<QueueMode>('idle');
  const [selectedGameMode, setSelectedGameMode] = useState<GameModeKey>(DEFAULT_MODE);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);

  const currentGameMode = getGameMode(selectedGameMode);
  const { t } = useTranslation();
  const { triggerRefresh } = useDashboardRefresh();

  // Demander la permission pour les notifications au montage
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Fonction pour envoyer une notification navigateur
  const sendMatchNotification = (roomCode: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('🎮 Match trouvé !', {
        body: `Room ${roomCode} - Clique pour rejoindre`,
        icon: '/logo.png',
        tag: 'psl-match',
        requireInteraction: true
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
    
    // Jouer un son de notification
    try {
      const audio = new Audio('/sounds/match-found.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  // Fermer le sélecteur de mode si on clique ailleurs
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modeSelectorRef.current && !modeSelectorRef.current.contains(event.target as Node)) {
        setShowModeSelector(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch queue counts au montage et périodiquement en mode idle
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/queue/status');
        if (res.ok) {
          const data = await res.json();
          if (data.queueCounts) {
            setQueueCounts(data.queueCounts);
          }
        }
      } catch (err) {}
    };
    
    fetchCounts();
    
    if (mode === 'idle') {
      const interval = setInterval(fetchCounts, 1000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  // Polling pour vérifier le statut de la queue et du match
  useEffect(() => {
    if (mode === 'searching' || mode === 'lobby') {
      const poll = async () => {
        try {
          const res = await fetch('/api/queue/status');
          if (res.ok) {
            const data = await res.json();
            
            if (data.queueCounts) {
              setQueueCounts(data.queueCounts);
            }
            
            if (mode === 'searching') {
              setQueueCount(data.count || 0);
              setCountdown(data.countdown || null);
              
              if (data.match) {
                // Match trouvé ! Passer en phase "found" (flash)
                setMatchInfo({
                  roomCode: data.match.roomCode,
                  players: data.match.players || [],
                  category: data.match.category || selectedGameMode
                });
                setMode('found');
                sendMatchNotification(data.match.roomCode);
                
                // Après 2.5s, passer en lobby
                setTimeout(() => {
                  setMode('lobby');
                }, 2500);
              }
            } else if (mode === 'lobby') {
              // Vérifier si le match est toujours actif
              if (!data.match && !data.inQueue) {
                console.log('🏁 Match terminé, retour à idle');
                setMode('idle');
                setMatchInfo(null);
                stopPolling();
                triggerRefresh();
              }
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      };

      poll();
      const interval = mode === 'searching' ? 500 : 2000;
      pollingRef.current = setInterval(poll, interval);
    }

    return () => stopPolling();
  }, [mode]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleJoinQueue = async () => {
    setMode('searching');
    setShowModeSelector(false);
    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: selectedGameMode,
          category: currentGameMode.category 
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.status === 'matched') {
          setMatchInfo({
            roomCode: data.roomCode,
            players: data.players || [],
            category: data.category || selectedGameMode
          });
          setMode('found');
          sendMatchNotification(data.roomCode);
          setTimeout(() => setMode('lobby'), 2500);
        } else {
          setQueueCount(data.count || 1);
        }
      } else {
        alert('Erreur: Impossible de rejoindre la queue');
        setMode('idle');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau');
      setMode('idle');
    }
  };

  const handleLeaveQueue = async () => {
    stopPolling();
    try {
      await fetch('/api/queue/leave', { method: 'POST' });
    } catch (err) {
      console.error('Error leaving queue:', err);
    }
    setMode('idle');
    setQueueCount(0);
    setMatchInfo(null);
  };

  const copyLink = () => {
    if (!matchInfo) return;
    const url = `https://jklm.fun/${matchInfo.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calcul de l'indicateur de niveau relatif (pour le 1er joueur = toi vs les autres)
  const getLevelIndicator = (myMmr: number, opponentMmr: number) => {
    const diff = myMmr - opponentMmr;
    if (diff > 50) return { type: 'favorite', icon: <Flame className="w-4 h-4" />, label: 'Favori', color: 'text-orange-400' };
    if (diff < -50) return { type: 'challenge', icon: <Target className="w-4 h-4" />, label: 'Défi', color: 'text-purple-400' };
    return { type: 'balanced', icon: <Scale className="w-4 h-4" />, label: 'Équilibré', color: 'text-blue-400' };
  };

  // Card classes dynamiques basées sur le mode
  const getCardClasses = () => {
    const base = "bg-card transition-all duration-500";
    switch (mode) {
      case 'found':
        return `${base} border-primary card-glow animate-pulse scale-105`;
      case 'lobby':
        return `${base} border-primary/50 card-glow`;
      default:
        return `${base} border-primary/30 card-glow`;
    }
  };

  return (
    <Card className={getCardClasses()}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">🎮 {t.navbar.play}</CardTitle>
        {mode === 'idle' && (
          <CardDescription>
            {t.dashboard.play_card.title}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* IDLE - Boutons principaux */}
        {mode === 'idle' && (
          <>
            {/* Sélecteur de mode */}
            <div className="relative" ref={modeSelectorRef}>
              <button
                type="button"
                onClick={() => setShowModeSelector(!showModeSelector)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-secondary/50 border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{currentGameMode.emoji}</span>
                  <span className="font-medium">{currentGameMode.label}</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${showModeSelector ? 'rotate-180' : ''}`} />
              </button>
              
              {showModeSelector && (
                <div className="absolute z-10 w-full mt-1 py-1 bg-card border border-border rounded-lg shadow-lg animate-in fade-in zoom-in-95 duration-150">
                  {GAME_MODE_LIST.map((gm) => (
                    <button
                      key={gm.key}
                      type="button"
                      onClick={() => {
                        setSelectedGameMode(gm.key);
                        setShowModeSelector(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-secondary transition-colors ${
                        selectedGameMode === gm.key ? 'bg-primary/10 text-primary' : ''
                      }`}
                    >
                      <span className="text-lg">{gm.emoji}</span>
                      <span>{gm.label}</span>
                      {selectedGameMode === gm.key && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button 
              onClick={handleJoinQueue}
              className="w-full h-14 text-lg bg-gradient-psl hover:opacity-90 transition-opacity glow-primary"
            >
              🔍 {t.common.search} ({currentGameMode.label})
            </Button>

            {/* Joueurs en recherche par catégorie */}
            {Object.keys(queueCounts).length > 0 && Object.values(queueCounts).some(c => c > 0) && (
              <div className="mt-3 p-3 bg-secondary/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {t.dashboard.play_card.in_queue.replace('{count}', '')}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {GAME_MODE_LIST.map((gm) => {
                    const count = queueCounts[gm.key] || 0;
                    if (count === 0) return null;
                    return (
                      <button 
                        key={gm.key} 
                        onClick={() => {
                          setSelectedGameMode(gm.key);
                          setTimeout(() => {
                            setMode('searching');
                            fetch('/api/queue/join', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ mode: gm.key, category: gm.category })
                            }).then(res => res.json()).then(data => {
                              if (data.status === 'matched') {
                                setMatchInfo({ roomCode: data.roomCode, players: data.players || [], category: data.category || gm.key });
                                setMode('found');
                                sendMatchNotification(data.roomCode);
                                setTimeout(() => setMode('lobby'), 2500);
                              } else {
                                setQueueCount(data.count || 1);
                              }
                            }).catch(() => setMode('idle'));
                          }, 0);
                        }}
                        className="text-xs px-2 py-1 bg-background/50 rounded hover:bg-primary/30 hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                        title={`Rejoindre ${gm.label}`}
                      >
                        {gm.emoji}
                        {(gm.key === 'GP_FR' || gm.key === 'NOFILTER_FR') && (
                          <span className="text-[10px] font-bold text-blue-400">FR</span>
                        )}
                        {(gm.key === 'MS_EN' || gm.key === 'NOFILTER_EN') && (
                          <span className="text-[10px] font-bold text-red-400">EN</span>
                        )}
                        {count}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* SEARCHING - En recherche */}
        {mode === 'searching' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="text-center py-4">
              <div className="relative inline-block">
                <div className="text-5xl mb-3 animate-bounce">🔍</div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping" />
              </div>
              <p className="text-lg font-medium">{t.dashboard.play_card.waiting}</p>
              <div className="flex items-center justify-center gap-2 mt-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{queueCount} {t.matches.live_players}</span>
              </div>
            </div>
            
            <div className="bg-secondary/30 rounded-lg p-3 text-center">
              {countdown !== null && countdown > 0 ? (
                <p className="text-lg font-bold text-primary">
                  ⏱️ Match dans {countdown}s...
                </p>
              ) : countdown === 0 ? (
                <p className="text-lg font-bold text-green-400">
                  🚀 Lancement du match...
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  La partie démarre dès que 2 joueurs sont prêts
                </p>
              )}
            </div>

            <Button 
              variant="outline"
              onClick={handleLeaveQueue}
              className="w-full flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              {t.dashboard.play_card.cancel}
            </Button>
          </div>
        )}

        {/* FOUND - Flash "Match Trouvé !" */}
        {mode === 'found' && matchInfo && (
          <div className="py-8 text-center animate-in zoom-in-110 fade-in duration-300">
            <div className="relative">
              <div className="text-6xl mb-4 animate-bounce">⚡</div>
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
            </div>
            <h2 className="text-3xl font-black text-primary animate-pulse">
              MATCH TROUVÉ !
            </h2>
            <p className="text-muted-foreground mt-2">Préparation du lobby...</p>
          </div>
        )}

        {/* LOBBY - Avant-Match détaillé */}
        {mode === 'lobby' && matchInfo && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header catégorie */}
            <div className="text-center pb-2 border-b border-border/50">
              <span className="text-2xl">{currentGameMode.emoji}</span>
              <h3 className="font-bold text-lg">{currentGameMode.label}</h3>
            </div>

            {/* Liste des joueurs */}
            <div className="space-y-3">
              {matchInfo.players.map((player, idx) => {
                const isFirst = idx === 0;
                const myMmr = matchInfo.players[0]?.mmr || 1000;
                const levelIndicator = !isFirst ? getLevelIndicator(myMmr, player.mmr) : null;
                
                return (
                  <div 
                    key={idx}
                    className={`relative p-3 rounded-lg transition-all ${
                      player.isTopRanked 
                        ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-2 border-amber-400/50 shadow-lg shadow-amber-400/20' 
                        : isFirst 
                          ? 'bg-primary/10 border border-primary/30'
                          : 'bg-secondary/30'
                    }`}
                  >
                    {/* Badge N°1 */}
                    {player.isTopRanked && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <Crown className="w-3 h-3" /> N°1
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Avatar placeholder */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          player.isTopRanked ? 'bg-amber-400/30' : 'bg-background'
                        }`}>
                          {isFirst ? '👤' : '🎮'}
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            {player.nickname}
                            {isFirst && <span className="text-xs text-muted-foreground">(toi)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {player.gamesPlayed} parties • {player.winrate}% WR
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-bold text-lg">{player.mmr}</div>
                        <div className="text-xs text-muted-foreground">
                          #{player.rank} classement
                        </div>
                      </div>
                    </div>
                    
                    {/* Indicateur de niveau relatif (seulement pour adversaires) */}
                    {levelIndicator && (
                      <div className={`mt-2 flex items-center gap-1 text-xs ${levelIndicator.color}`}>
                        {levelIndicator.icon}
                        <span>{levelIndicator.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Room Code & Actions */}
            <div className="pt-4 border-t border-border/50 space-y-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Code Room</p>
                <div className="text-3xl font-mono font-black tracking-wider text-primary">
                  {matchInfo.roomCode}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={copyLink}
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? t.common.copied : t.common.copy}
                </Button>
                <Button 
                  className="flex-1 bg-gradient-psl"
                  onClick={() => window.open(`https://jklm.fun/${matchInfo.roomCode}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t.dashboard.play_card.join}
                </Button>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm"
                className="w-full text-muted-foreground hover:text-white"
                onClick={handleLeaveQueue}
              >
                {t.common.back}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

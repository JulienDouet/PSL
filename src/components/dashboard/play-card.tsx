'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Check, Users, Loader2, X, ChevronDown } from 'lucide-react';
import { GAME_MODE_LIST, DEFAULT_MODE, getGameMode, type GameModeKey } from '@/lib/game-modes';
import { useTranslation } from "@/lib/i18n/context";

type QueueMode = 'idle' | 'searching' | 'matched';

interface MatchInfo {
  roomCode: string;
  players: { nickname: string; mmr: number }[];
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
        tag: 'psl-match', // Évite les doublons
        requireInteraction: true // Reste affiché jusqu'à interaction
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
      audio.play().catch(() => {}); // Ignorer si bloqué par le navigateur
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
    
    // Fetch immédiat
    fetchCounts();
    
    // Polling toutes les 5 secondes en mode idle
    if (mode === 'idle') {
      const interval = setInterval(fetchCounts, 1000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  // Polling pour vérifier le statut de la queue et du match
  useEffect(() => {
    if (mode === 'searching' || mode === 'matched') {
      const poll = async () => {
        try {
          const res = await fetch('/api/queue/status');
          if (res.ok) {
            const data = await res.json();
            
            // Mettre à jour les counts globaux
            if (data.queueCounts) {
              setQueueCounts(data.queueCounts);
            }
            
            if (mode === 'searching') {
              setQueueCount(data.count || 0);
              setCountdown(data.countdown || null);
              
              if (data.match) {
                // Match trouvé !
                setMatchInfo({
                  roomCode: data.match.roomCode,
                  players: data.match.players || []
                });
                setMode('matched');
                
                // Envoyer notification navigateur
                sendMatchNotification(data.match.roomCode);
              }
            } else if (mode === 'matched') {
              // En mode matched, vérifier si le match est toujours actif
              if (!data.match && !data.inQueue) {
                // Le match est terminé (plus dans pendingMatches)
                console.log('🏁 Match terminé, retour à idle');
                setMode('idle');
                setMatchInfo(null);
                stopPolling();
              }
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      };

      // Premier appel immédiat
      poll();
      // Puis toutes les 1 seconde (searching) ou 3 secondes (matched)
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
          // Match instantané (assez de joueurs déjà en queue)
          setMatchInfo({
            roomCode: data.roomCode,
            players: data.players || []
          });
          setMode('matched');
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
  };

  const copyLink = () => {
    if (!matchInfo) return;
    const url = `https://jklm.fun/${matchInfo.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackToIdle = () => {
    handleLeaveQueue();
    setMatchInfo(null);
  };

  return (
    <Card className="bg-card border-primary/30 card-glow">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">🎮 {t.navbar.play}</CardTitle>
        <CardDescription>
          {t.dashboard.play_card.title}
        </CardDescription>
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
                          // Petite attente pour que le state soit mis à jour avant handleJoinQueue
                          setTimeout(() => {
                            setMode('searching');
                            fetch('/api/queue/join', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ mode: gm.key, category: gm.category })
                            }).then(res => res.json()).then(data => {
                              if (data.status === 'matched') {
                                setMatchInfo({ roomCode: data.roomCode, players: data.players || [] });
                                setMode('matched');
                                sendMatchNotification(data.roomCode);
                              } else {
                                setQueueCount(data.count || 1);
                              }
                            }).catch(() => setMode('idle'));
                          }, 0);
                        }}
                        className="text-xs px-2 py-1 bg-background/50 rounded hover:bg-primary/30 hover:text-primary transition-colors cursor-pointer"
                        title={`Rejoindre ${gm.label}`}
                      >
                        {gm.emoji} {count}
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
                <div className="text-5xl mb-3">🔍</div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
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

        {/* MATCHED - Match trouvé ! */}
        {mode === 'matched' && matchInfo && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="text-center">
              <p className="text-lg font-medium text-green-400 mb-2">🎉 Match trouvé !</p>
              <div className="bg-background border border-primary/50 text-2xl font-mono p-3 rounded-lg flex items-center justify-center gap-3">
                <span>{matchInfo.roomCode}</span>
              </div>
            </div>

            {matchInfo.players.length > 0 && (
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-2">Joueurs ({matchInfo.players.length})</p>
                <div className="flex flex-wrap gap-2">
                  {matchInfo.players.map((p, i) => (
                    <span key={i} className="px-2 py-1 bg-background rounded text-sm">
                      {p.nickname}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
              onClick={handleBackToIdle}
            >
              {t.common.back}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


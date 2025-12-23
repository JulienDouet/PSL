'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Check, Users, X, ChevronDown, Crown, Target, Flame, Scale } from 'lucide-react';
import { GAME_MODE_LIST, DEFAULT_MODE, getGameMode, type GameModeKey } from '@/lib/game-modes';
import { useTranslation } from "@/lib/i18n/context";
import { useDashboardRefresh } from '@/lib/dashboard-context';

// 6 états : idle → searching → found → lobby → missed (si timeout) / results (après match)
type QueueMode = 'idle' | 'searching' | 'found' | 'lobby' | 'missed' | 'results';

interface EnrichedPlayer {
  id: string; // userId
  nickname: string;
  mmr: number;
  gamesPlayed: number;
  winrate: number;
  rank: number;
  isTopRanked: boolean;
  currentStreak: number; // Win streak
}

interface MatchInfo {
  roomCode: string;
  players: EnrichedPlayer[];
  category: string;
}

interface MatchResult {
  matchId: string;
  placement: number;
  playersCount: number;
  mmrBefore: number;
  mmrAfter: number;
  mmrChange: number;
  category: string;
}

export function PlayCard() {
  const [mode, setMode] = useState<QueueMode>('idle');
  const [selectedGameMode, setSelectedGameMode] = useState<GameModeKey>(DEFAULT_MODE);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [queuePlayers, setQueuePlayers] = useState<EnrichedPlayer[]>([]);
  const [matchTimeoutRemaining, setMatchTimeoutRemaining] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);
  const matchFoundRef = useRef<string | null>(null); // Track which match we already processed

  const currentGameMode = getGameMode(selectedGameMode);
  const { t } = useTranslation();
  const { triggerRefresh, setQueueMode } = useDashboardRefresh();

  // Synchroniser l'état local avec le context global (pour l'animation d'expansion)
  useEffect(() => {
    // Mapper l'état local vers le mode d'expansion
    if (mode === 'idle') {
      setQueueMode('idle');
    } else if (mode === 'searching') {
      // Si on a des joueurs en queue (countdown actif), c'est "countdown"
      if (queuePlayers.length >= 2) {
        setQueueMode('countdown');
      } else {
        setQueueMode('searching');
      }
    } else if (mode === 'found') {
      setQueueMode('found');
    } else if (mode === 'lobby') {
      setQueueMode('lobby');
    }
  }, [mode, queuePlayers.length, setQueueMode]);

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
      const interval = setInterval(fetchCounts, 5000); // 5s au lieu de 1s
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
            
            if (data.currentUserId) {
              setCurrentUserId(data.currentUserId);
            }
            
            if (mode === 'searching') {
              setQueueCount(data.count || 0);
              setCountdown(data.countdown || null);
              
              // Si des joueurs sont en queue avec countdown, les afficher
              if (data.queuePlayers && data.queuePlayers.length >= 2) {
                setQueuePlayers(data.queuePlayers);
              } else {
                setQueuePlayers([]);
              }
              
              // Match trouvé ! Passer en phase "found" (flash) seulement si c'est un nouveau match
              if (data.match && matchFoundRef.current !== data.match.roomCode) {
                matchFoundRef.current = data.match.roomCode;
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
              // IMPORTANT: Vérifier d'abord si le match existe encore
              // Si le match n'existe plus, c'est que la partie a commencé ou s'est terminée
              if (!data.match && !data.inQueue) {
                // Fetch le dernier résultat pour afficher l'écran post-match
                try {
                  const resultRes = await fetch('/api/user/latest-result');
                  if (resultRes.ok) {
                    const resultData = await resultRes.json();
                    if (resultData.result) {
                      // Résultat récent trouvé → afficher l'écran results
                      setMatchResult(resultData.result);
                      setMode('results');
                      setMatchInfo(null);
                      setMatchTimeoutRemaining(null);
                      matchFoundRef.current = null;
                      stopPolling();
                      triggerRefresh();
                      return;
                    }
                  }
                } catch (err) {
                  console.error('Error fetching latest result:', err);
                }
                
                // Pas de résultat récent → retour en idle
                setMode('idle');
                setMatchInfo(null);
                setMatchTimeoutRemaining(null);
                matchFoundRef.current = null;
                stopPolling();
                triggerRefresh();
                return;
              }
              
              // Mettre à jour le timeout restant
              if (data.matchTimeoutRemaining !== undefined) {
                setMatchTimeoutRemaining(data.matchTimeoutRemaining);
                
                // Si timeout expiré, vérifier s'il y a des résultats récents
                // (le joueur a peut-être rejoint et terminé la partie)
                if (data.matchTimeoutRemaining <= 0) {
                  try {
                    const resultRes = await fetch('/api/user/latest-result');
                    if (resultRes.ok) {
                      const resultData = await resultRes.json();
                      if (resultData.result) {
                        // Résultat trouvé ! La partie est terminée
                        setMatchResult(resultData.result);
                        setMode('results');
                        setMatchInfo(null);
                        setMatchTimeoutRemaining(null);
                        matchFoundRef.current = null;
                        stopPolling();
                        triggerRefresh();
                        return;
                      }
                    }
                  } catch (err) {
                    console.error('Error fetching results on timeout:', err);
                  }
                  
                  // Pas de résultat mais le match existe toujours
                  // → Le joueur est probablement en train de jouer, on continue de poll
                  // Le mode "missed" ne s'affichera que si le match disparaît sans résultat
                }
              }
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      };

      poll();
      const interval = mode === 'searching' ? 2000 : 5000; // 2s en recherche, 5s en lobby
      pollingRef.current = setInterval(poll, interval);
    }

    return () => stopPolling();
  }, [mode]); // matchInfo retiré des deps pour éviter les boucles

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
    matchFoundRef.current = null; // Reset pour permettre un nouveau match
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
            {/* Header avec countdown */}
            <div className="text-center py-2">
              {countdown !== null && countdown > 0 ? (
                <>
                  <div className="text-4xl font-black text-primary animate-pulse">
                    ⏱️ {countdown}s
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Match imminent !</p>
                </>
              ) : queuePlayers.length >= 2 ? (
                <>
                  <div className="text-2xl mb-1">⭐</div>
                  <p className="text-lg font-medium">Joueurs prêts !</p>
                </>
              ) : (
                <>
                  <div className="relative inline-block">
                    <div className="text-4xl mb-2 animate-bounce">🔍</div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping" />
                  </div>
                  <p className="text-lg font-medium">{t.dashboard.play_card.waiting}</p>
                  <div className="flex items-center justify-center gap-2 mt-1 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{queueCount} {t.matches.live_players}</span>
                  </div>
                </>
              )}
            </div>
            
            {/* Liste des joueurs en attente (affichée quand countdown actif) */}
            {queuePlayers.length >= 2 && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {queuePlayers.map((player, idx) => {
                  const isMe = currentUserId && player.id === currentUserId;
                  const myPlayer = queuePlayers.find(p => p.id === currentUserId);
                  const myMmr = myPlayer?.mmr || 1000;
                  const levelIndicator = !isMe ? getLevelIndicator(myMmr, player.mmr) : null;
                  
                  return (
                    <div 
                      key={idx}
                      className={`relative p-2 rounded-lg transition-all ${
                        player.isTopRanked 
                          ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-400/50' 
                          : isMe 
                            ? 'bg-primary/10 border border-primary/30'
                            : 'bg-secondary/30'
                      }`}
                    >
                      {/* Badge N°1 */}
                      {player.isTopRanked && (
                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" /> N°1
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                            player.isTopRanked ? 'bg-amber-400/30' : 'bg-background'
                          }`}>
                            {isMe ? '👤' : '🎮'}
                          </div>
                          <div>
                            <div className="font-medium text-sm flex items-center gap-1">
                              {player.nickname}
                              {currentUserId && player.id === currentUserId && <span className="text-[10px] text-muted-foreground">(toi)</span>}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {player.gamesPlayed} parties • {player.winrate}% WR
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="font-bold text-sm">{player.mmr}</div>
                          <div className="text-[10px] text-muted-foreground">#{player.rank}</div>
                        </div>
                      </div>
                      
                      {/* Indicateur de niveau */}
                      {levelIndicator && (
                        <div className={`mt-1 flex items-center gap-1 text-[10px] ${levelIndicator.color}`}>
                          {levelIndicator.icon}
                          <span>{levelIndicator.label}</span>
                        </div>
                      )}
                      
                      {/* Streak indicator - opportunity for bonus MMR */}
                      {player.currentStreak >= 3 && player.id !== currentUserId && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400">
                          🎯 <span>{t.dashboard.play_card.streak_opportunity?.replace('{n}', String(player.currentStreak)) || `Streak x${player.currentStreak}`}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Message d'attente si pas assez de joueurs */}
            {queuePlayers.length < 2 && (
              <div className="bg-secondary/30 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  La partie démarre dès que 2 joueurs sont prêts
                </p>
              </div>
            )}

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
            {/* Header catégorie + Timeout */}
            <div className="text-center pb-2 border-b border-border/50">
              <span className="text-2xl">{currentGameMode.emoji}</span>
              <h3 className="font-bold text-lg">{currentGameMode.label}</h3>
              
              {/* Countdown timeout pour rejoindre (60s total) */}
              {matchTimeoutRemaining !== null && matchTimeoutRemaining > 0 && (
                <div className={`mt-2 text-sm font-medium ${
                  matchTimeoutRemaining <= 15 ? 'text-red-400 animate-pulse' : 
                  matchTimeoutRemaining <= 30 ? 'text-amber-400' : 'text-muted-foreground'
                }`}>
                  ⏱️ Rejoins le lobby dans {matchTimeoutRemaining}s
                </div>
              )}
            </div>

            {/* Liste des joueurs */}
            <div className="space-y-3">
              {matchInfo.players.map((player, idx) => {
                const isMe = currentUserId && player.id === currentUserId;
                const myPlayer = matchInfo.players.find(p => p.id === currentUserId);
                const myMmr = myPlayer?.mmr || 1000;
                const levelIndicator = !isMe ? getLevelIndicator(myMmr, player.mmr) : null;
                
                return (
                  <div 
                    key={idx}
                    className={`relative p-3 rounded-lg transition-all ${
                      player.isTopRanked 
                        ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-2 border-amber-400/50 shadow-lg shadow-amber-400/20' 
                        : isMe 
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
                          {isMe ? '👤' : '🎮'}
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            {player.nickname}
                            {isMe && <span className="text-xs text-muted-foreground">(toi)</span>}
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
                  {t.dashboard.play_card.play}
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

        {/* MISSED - Match loupé */}
        {mode === 'missed' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="text-center py-6">
              <div className="text-5xl mb-4">😞</div>
              <h3 className="text-xl font-bold text-red-400">Match loupé !</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Tu n'as pas rejoint le lobby à temps.
              </p>
              <p className="text-sm text-muted-foreground">
                Le match a commencé sans toi.
              </p>
            </div>
            
            <Button 
              className="w-full bg-gradient-psl"
              onClick={() => {
                setMode('idle');
                setMatchInfo(null);
                setMatchTimeoutRemaining(null);
                triggerRefresh();
              }}
            >
              🔍 Rechercher un nouveau match
            </Button>
          </div>
        )}

        {/* RESULTS - Résultats post-match avec jauge MMR animée */}
        {mode === 'results' && matchResult && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            {/* Placement Header */}
            <div className="text-center py-4">
              <div className="text-6xl mb-3 animate-bounce">
                {matchResult.placement === 1 ? '🥇' : 
                 matchResult.placement === 2 ? '🥈' : 
                 matchResult.placement === 3 ? '🥉' : '🎮'}
              </div>
              <h3 className={`text-2xl font-black ${
                matchResult.placement === 1 ? 'text-amber-400' :
                matchResult.mmrChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {matchResult.placement === 1 ? 'VICTOIRE !' :
                 matchResult.placement === 2 ? 'Bien joué !' :
                 matchResult.placement === 3 ? 'Pas mal !' : 'Partie terminée'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {matchResult.placement === 1 ? '1er' : `${matchResult.placement}${matchResult.placement === 2 ? 'ème' : 'ème'}`} / {matchResult.playersCount} joueurs
              </p>
            </div>

            {/* MMR Gauge */}
            <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">MMR</span>
                <span className={`font-bold text-lg ${
                  matchResult.mmrChange > 0 ? 'text-green-400' : 
                  matchResult.mmrChange < 0 ? 'text-red-400' : 'text-muted-foreground'
                }`}>
                  {matchResult.mmrChange > 0 ? '+' : ''}{matchResult.mmrChange}
                  {matchResult.mmrChange > 0 && ' 🔥'}
                  {matchResult.mmrChange < 0 && ' 📉'}
                </span>
              </div>
              
              {/* Animated Progress Bar */}
              <div className="relative h-4 bg-background rounded-full overflow-hidden">
                {/* Background track */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-900/50 to-cyan-900/50" />
                
                {/* Animated fill - uses CSS animation */}
                <div 
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${
                    matchResult.mmrChange >= 0 
                      ? 'bg-gradient-to-r from-purple-500 to-cyan-400' 
                      : 'bg-gradient-to-r from-red-600 to-red-400'
                  }`}
                  style={{
                    // Animate width based on MMR (scale 0-2000 for visual)
                    width: `${Math.min(100, Math.max(5, (matchResult.mmrAfter / 2000) * 100))}%`,
                    animation: 'mmrGrow 1s ease-out forwards',
                  }}
                />
                
                {/* Glow effect on change */}
                {matchResult.mmrChange !== 0 && (
                  <div 
                    className={`absolute inset-y-0 rounded-full blur-sm animate-pulse ${
                      matchResult.mmrChange > 0 ? 'bg-green-400/30' : 'bg-red-400/30'
                    }`}
                    style={{
                      left: `${Math.min(95, Math.max(0, ((matchResult.mmrBefore) / 2000) * 100))}%`,
                      width: `${Math.abs(matchResult.mmrChange) / 20}%`,
                    }}
                  />
                )}
              </div>
              
              {/* MMR Values */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">
                  {matchResult.mmrBefore}
                </span>
                <span className="text-primary font-bold text-base">
                  → {matchResult.mmrAfter}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button 
                className="w-full bg-gradient-psl hover:opacity-90 h-12"
                onClick={() => {
                  setMode('idle');
                  setMatchResult(null);
                  handleJoinQueue();
                }}
              >
                🔍 Nouveau match
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="w-full text-muted-foreground hover:text-white"
                onClick={() => {
                  setMode('idle');
                  setMatchResult(null);
                }}
              >
                Retour
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

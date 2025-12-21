'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Check, Users, Loader2, X, ChevronDown } from 'lucide-react';
import { GAME_MODE_LIST, DEFAULT_MODE, getGameMode, type GameModeKey } from '@/lib/game-modes';

type QueueMode = 'idle' | 'searching' | 'matched' | 'manual';

interface MatchInfo {
  roomCode: string;
  players: { nickname: string; mmr: number }[];
}

export function PlayCard() {
  const [mode, setMode] = useState<QueueMode>('idle');
  const [selectedGameMode, setSelectedGameMode] = useState<GameModeKey>(DEFAULT_MODE);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [manualRoomCode, setManualRoomCode] = useState('');
  const [queueCount, setQueueCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);

  const currentGameMode = getGameMode(selectedGameMode);

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

  // Polling pour vérifier le statut de la queue et du match
  useEffect(() => {
    if (mode === 'searching' || mode === 'matched') {
      const poll = async () => {
        try {
          const res = await fetch('/api/queue/status');
          if (res.ok) {
            const data = await res.json();
            
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
      const interval = mode === 'searching' ? 1000 : 3000;
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

  const handleJoinManualRoom = async () => {
    if (manualRoomCode.length !== 4) return;
    
    try {
      const res = await fetch('/api/match/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: manualRoomCode.toUpperCase() })
      });
      
      if (res.ok) {
        alert(`Bot lancé sur ${manualRoomCode.toUpperCase()} !`);
        setMode('idle');
        setManualRoomCode('');
      } else {
        alert('Erreur: Impossible de lancer le bot');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau');
    }
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
        <CardTitle className="text-2xl">🎮 Jouer</CardTitle>
        <CardDescription>
          Lance une partie ranked PSL
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
              🔍 Rechercher ({currentGameMode.label})
            </Button>
            <Button 
              variant="outline"
              onClick={() => setMode('manual')}
              className="w-full"
            >
              📝 Rejoindre une room existante
            </Button>
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
              <p className="text-lg font-medium">Recherche en cours...</p>
              <div className="flex items-center justify-center gap-2 mt-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{queueCount} joueur{queueCount > 1 ? 's' : ''} en attente</span>
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
              Annuler la recherche
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
                {copied ? 'Copié !' : 'Lien'}
              </Button>
              <Button 
                className="flex-1 bg-gradient-psl"
                onClick={() => window.open(`https://jklm.fun/${matchInfo.roomCode}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Rejoindre
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              className="w-full text-muted-foreground hover:text-white"
              onClick={handleBackToIdle}
            >
              Retour
            </Button>
          </div>
        )}

        {/* MANUAL - Rejoindre une room manuelle */}
        {mode === 'manual' && (
          <div className="space-y-3 animate-in fade-in zoom-in duration-200">
            <p className="text-sm font-medium text-center">Entrez le code JKLM</p>
            <input
              type="text"
              maxLength={4}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase text-center font-mono tracking-widest text-lg"
              placeholder="ABCD"
              value={manualRoomCode}
              onChange={(e) => setManualRoomCode(e.target.value.toUpperCase())}
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setMode('idle')}
              >
                Retour
              </Button>
              <Button 
                className="flex-1 bg-gradient-psl"
                onClick={handleJoinManualRoom}
                disabled={manualRoomCode.length !== 4}
              >
                GO !
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Le bot attend que tous les joueurs rejoignent
        </p>
      </CardContent>
    </Card>
  );
}

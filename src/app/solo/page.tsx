'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Clock, Zap, Target, Play, X, ExternalLink, Shield } from 'lucide-react';
import Link from 'next/link';
import type { Category, SoloMode as SoloModeType } from '@prisma/client';
import { authClient } from '@/lib/auth-client';
import { Navbar } from '@/components/navbar';
import { useTranslation } from '@/lib/i18n/context';

// Mode configuration
const SOLO_MODES = {
  HARDCORE: { 
    duration: 5, 
    label: 'Hardcore', 
    emoji: '💀',
    description: '5 secondes par question',
    color: 'from-red-600 to-orange-500',
    icon: Zap
  },
  CHALLENGE: { 
    duration: 8, 
    label: 'Challenge', 
    emoji: '⚡',
    description: '8 secondes par question',
    color: 'from-purple-600 to-pink-500',
    icon: Target
  },
  NORMAL: { 
    duration: 12, 
    label: 'Normal', 
    emoji: '🎯',
    description: '12 secondes par question',
    color: 'from-blue-600 to-cyan-500',
    icon: Clock
  }
};

// Categories available for solo
const CATEGORIES = [
  { key: 'GP_FR', label: 'Grand Public FR', emoji: '🍿' },
  { key: 'MS_EN', label: 'Mainstream EN', emoji: '🍿' },
  { key: 'ANIME', label: 'Anime/Manga', emoji: '🎌' },
  { key: 'FLAGS', label: 'Drapeaux', emoji: '🚩' },
  { key: 'NOFILTER_FR', label: 'Sans Filtre FR', emoji: '🔥' },
  { key: 'NOFILTER_EN', label: 'No Filter EN', emoji: '🔥' },
];

interface ActiveSession {
  id: string;
  category: Category;
  mode: SoloModeType;
  streak: number;
  bestStreak: number;
  roomCode: string | null;
  startedAt: string;
}

interface BestStreak {
  category: Category;
  mode: SoloModeType;
  bestStreak: number;
}

export default function SoloPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<Category>('GP_FR');
  const [selectedMode, setSelectedMode] = useState<SoloModeType>('NORMAL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [bestStreaks, setBestStreaks] = useState<BestStreak[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check admin status on mount
  useEffect(() => {
    async function checkAdmin() {
      try {
        const { data } = await authClient.getSession();
        if (!data?.user?.id) {
          router.push('/login');
          return;
        }
        
        // Check if user is admin via API
        const res = await fetch('/api/solo/start');
        if (res.status === 401 || res.status === 403) {
          router.push('/dashboard');
          return;
        }
        
        setIsAdmin(true);
        
        // Check for active session
        if (res.ok) {
          const responseData = await res.json();
          if (responseData.active) {
            setActiveSession(responseData.session);
          }
        }
      } catch (err) {
        console.error('Error checking admin:', err);
        router.push('/dashboard');
      } finally {
        setCheckingAuth(false);
      }
    }
    
    checkAdmin();
  }, [router]);

  // Poll for roomCode when session is active but room not yet created
  useEffect(() => {
    if (!activeSession || activeSession.roomCode) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/solo/start');
        if (res.ok) {
          const data = await res.json();
          if (data.active && data.session) {
            setActiveSession(data.session);
            // Stop polling once we have roomCode
            if (data.session.roomCode) {
              clearInterval(pollInterval);
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [activeSession]);

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-24">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">{t.solo.checking}</p>
          </div>
        </div>
      </div>
    );
  }

  // Only show to admins
  if (!isAdmin) {
    return null;
  }

  const checkActiveSession = async () => {
    try {
      const res = await fetch('/api/solo/start');
      if (res.ok) {
        const data = await res.json();
        if (data.active) {
          setActiveSession(data.session);
        }
      }
    } catch (err) {
      console.error('Error checking session:', err);
    }
  };

  const fetchBestStreaks = async () => {
    // TODO: Fetch user's best streaks from API
    // For now, just leave empty
  };

  const handleStartSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/solo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          mode: selectedMode
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.existingSession) {
          // Already has active session
          setActiveSession(data.existingSession);
          setError('Tu as déjà une session en cours');
        } else {
          setError(data.error || 'Erreur lors du démarrage');
        }
        return;
      }

      // Session created - show waiting state
      setActiveSession({
        id: data.session.id,
        category: selectedCategory,
        mode: selectedMode,
        streak: 0,
        bestStreak: 0,
        roomCode: null,
        startedAt: new Date().toISOString()
      });

    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;

    try {
      await fetch('/api/solo/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          reason: 'ABANDONED'
        })
      });
      setActiveSession(null);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  };

  const modeConfig = SOLO_MODES[selectedMode];
  const ModeIcon = modeConfig.icon;

  // If there's an active session, show session UI
  if (activeSession) {
    const sessionMode = SOLO_MODES[activeSession.mode];
    
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-2xl mx-auto px-4 pt-24 pb-8">
          <Card className="border-primary/30">
            <CardHeader className="text-center">
              <div className="text-4xl mb-2">{sessionMode.emoji}</div>
              <CardTitle className="text-2xl">{t.solo.active_session}</CardTitle>
              <CardDescription>
                {t.categories[activeSession.category as keyof typeof t.categories]} • {t.solo[`mode_${activeSession.mode.toLowerCase()}` as keyof typeof t.solo]}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Best Streak Display */}
              <div className="text-center py-6 bg-secondary/30 rounded-xl">
                <div className="text-6xl font-black text-primary mb-2">
                  🔥 {activeSession.bestStreak}
                </div>
                <p className="text-muted-foreground">{t.solo.best_streak}</p>
                {activeSession.streak > 0 && (
                  <p className="text-sm text-green-400 mt-1">
                    ✨ En cours: {activeSession.streak}
                  </p>
                )}
              </div>

              {/* Room Code (when available) */}
              {activeSession.roomCode ? (
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Room JKLM</p>
                  <div className="text-3xl font-mono font-bold text-primary">
                    {activeSession.roomCode}
                  </div>
                  <Button
                    className="mt-3 bg-gradient-to-r from-purple-600 to-pink-500"
                    onClick={() => window.open(`https://jklm.fun/${activeSession.roomCode}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Rejoindre le lobby
                  </Button>
                </div>
              ) : (
                <div className="text-center p-4 bg-secondary/30 rounded-lg">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-muted-foreground">Création du lobby...</p>
                </div>
              )}

              {/* End Session Button */}
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleEndSession}
              >
                <X className="w-4 h-4 mr-2" />
                {t.solo.stop_session}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Mode selection UI
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl mx-auto px-4 pt-24 pb-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">🎯 {t.solo.title}</h1>
            <p className="text-muted-foreground">{t.solo.subtitle}</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Category Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📚 {t.solo.select_category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key as Category)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                    selectedCategory === cat.key
                      ? 'bg-primary/20 border-2 border-primary'
                      : 'bg-secondary/30 border-2 border-transparent hover:border-primary/30'
                  }`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="font-medium">{t.categories[cat.key as keyof typeof t.categories]}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Right: Mode Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">⏱️ {t.solo.select_mode}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.keys(SOLO_MODES) as SoloModeType[]).map((mode) => {
                const config = SOLO_MODES[mode];
                const Icon = config.icon;
                
                return (
                  <button
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg transition-all ${
                      selectedMode === mode
                        ? `bg-gradient-to-r ${config.color} text-white`
                        : 'bg-secondary/30 hover:bg-secondary/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedMode === mode ? 'bg-white/20' : 'bg-background'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold flex items-center gap-2">
                        {t.solo[`mode_${mode.toLowerCase()}` as keyof typeof t.solo]}
                      </div>
                      <div className={`text-sm ${selectedMode === mode ? 'text-white/80' : 'text-muted-foreground'}`}>
                        {t.solo[`mode_${mode.toLowerCase()}_desc` as keyof typeof t.solo]}
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Start Button */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-bold text-lg">
                  {CATEGORIES.find(c => c.key === selectedCategory)?.emoji}{' '}
                  {t.categories[selectedCategory as keyof typeof t.categories]}
                </h3>
                <p className="text-muted-foreground">
                  {modeConfig.emoji} {t.solo[`mode_${selectedMode.toLowerCase()}` as keyof typeof t.solo]} • {t.solo[`mode_${selectedMode.toLowerCase()}_desc` as keyof typeof t.solo]}
                </p>
              </div>
              
              <Button
                size="lg"
                disabled={isLoading}
                onClick={handleStartSession}
                className={`w-full md:w-auto min-w-[200px] h-14 text-lg bg-gradient-to-r ${modeConfig.color}`}
              >
                {isLoading ? (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    {t.solo.start_session}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

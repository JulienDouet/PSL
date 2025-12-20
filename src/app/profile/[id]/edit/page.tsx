'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { useSession } from "@/lib/auth-client";
import { Loader2, Check, ExternalLink, Copy, X } from 'lucide-react';

interface VerificationStatus {
  status: 'none' | 'pending' | 'verified';
  code?: string;
  roomCode?: string;
  roomUrl?: string;
  jklmUsername?: string;
  expiresAt?: string;
}

export default function ProfileEditPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const router = useRouter();
  
  const [displayName, setDisplayName] = useState('');
  const [jklmUsername, setJklmUsername] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<VerificationStatus>({ status: 'none' });
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Charger les données utilisateur
  useEffect(() => {
    if (session?.user) {
      setDisplayName((session.user as any).displayName || session.user.name || '');
      checkVerificationStatus();
    }
  }, [session]);

  // Vérifier le statut de vérification JKLM
  const checkVerificationStatus = async () => {
    try {
      const res = await fetch('/api/jklm/verify/status');
      if (res.ok) {
        const data = await res.json();
        setVerifyStatus(data);
        if (data.jklmUsername) {
          setJklmUsername(data.jklmUsername);
        }
      }
    } catch (err) {
      console.error('Error checking verification status:', err);
    }
  };

  // Sauvegarder le displayName
  const handleSaveDisplayName = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName })
      });
      if (res.ok) {
        alert('Pseudo mis à jour !');
      }
    } catch (err) {
      console.error('Error saving:', err);
    }
    setSaving(false);
  };

  // Lancer la vérification JKLM
  const handleStartVerification = async () => {
    if (!jklmUsername.trim()) return;
    
    setVerifying(true);
    try {
      const res = await fetch('/api/jklm/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jklmUsername: jklmUsername.trim() })
      });
      
      if (res.ok) {
        const data = await res.json();
        setVerifyStatus({
          status: 'pending',
          code: data.code,
          roomCode: data.roomCode,
          roomUrl: data.roomUrl,
          jklmUsername: jklmUsername.trim(),
          expiresAt: data.expiresAt
        });
      } else {
        const error = await res.json();
        alert(error.error || 'Erreur lors de la vérification');
      }
    } catch (err) {
      console.error('Error starting verification:', err);
    }
    setVerifying(false);
  };

  // Poll pour vérifier si la vérification est terminée
  useEffect(() => {
    if (verifyStatus.status !== 'pending') return;
    
    const interval = setInterval(async () => {
      await checkVerificationStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [verifyStatus.status]);

  const copyCode = () => {
    if (verifyStatus.code) {
      navigator.clipboard.writeText(verifyStatus.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (sessionPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="mb-6">
            <Link href={`/profile/${session.user.id}`} className="text-muted-foreground hover:text-foreground transition-colors">
              ← Retour au profil
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-6">
            ⚙️ <span className="text-gradient">Modifier mon profil</span>
          </h1>

          {/* Display Name */}
          <Card className="bg-card border-border/50 mb-6">
            <CardHeader>
              <CardTitle>Pseudo affiché</CardTitle>
              <CardDescription>
                Ce nom sera affiché sur PSL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Ton pseudo"
              />
              <Button 
                onClick={handleSaveDisplayName}
                disabled={saving}
                className="bg-gradient-psl"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Sauvegarder
              </Button>
            </CardContent>
          </Card>

          {/* JKLM Linking */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🎮 Liaison JKLM.fun
                {verifyStatus.status === 'verified' && (
                  <span className="text-sm bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                    ✓ Vérifié
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Lie ton pseudo JKLM pour que tes parties soient comptabilisées
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Déjà vérifié */}
              {verifyStatus.status === 'verified' && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-green-400 font-medium">
                    Compte lié : <span className="text-white">{verifyStatus.jklmUsername}</span>
                  </p>
                </div>
              )}

              {/* Pas encore lié */}
              {verifyStatus.status === 'none' && (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Ton pseudo JKLM.fun
                    </label>
                    <input
                      type="text"
                      value={jklmUsername}
                      onChange={(e) => setJklmUsername(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Ex: Hyceman"
                    />
                  </div>
                  <Button 
                    onClick={handleStartVerification}
                    disabled={verifying || !jklmUsername.trim()}
                    className="bg-gradient-psl"
                  >
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Lancer la vérification
                  </Button>
                </>
              )}

              {/* Vérification en cours */}
              {verifyStatus.status === 'pending' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                    <p className="font-medium mb-2">📍 Vérification en cours pour : {verifyStatus.jklmUsername}</p>
                    <ol className="text-sm text-muted-foreground space-y-2">
                      <li>1. Rejoins la room de vérification :</li>
                      <li className="pl-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(verifyStatus.roomUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          jklm.fun/{verifyStatus.roomCode}
                        </Button>
                      </li>
                      <li>2. Tape ce code dans le chat :</li>
                      <li className="pl-4">
                        <div className="inline-flex items-center gap-2 px-3 py-2 bg-background rounded border font-mono text-lg">
                          {verifyStatus.code}
                          <Button variant="ghost" size="sm" onClick={copyCode}>
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </li>
                      <li>3. Le bot validera automatiquement !</li>
                    </ol>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      En attente de validation...
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={async () => {
                        await fetch('/api/jklm/verify/cancel', { method: 'DELETE' });
                        setVerifyStatus({ status: 'none' });
                      }}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Annuler / Recommencer
                    </Button>
                  </div>
                </div>
              )}
              
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { joinQueue, canStartMatch, popPlayersForMatch, registerPendingMatch, getQueueStatus, cancelMatchingPlayers, isLobbyTimerExpired, clearLobbyTimer } from '@/lib/queue';
import { getGameMode, type GameModeKey } from '@/lib/game-modes';
import { spawn } from 'child_process';
import path from 'path';
import type { Category } from '@prisma/client';

export async function POST(req: Request) {
  try {
    // Vérifier l'authentification
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const modeKey: GameModeKey = body.mode || 'GP_FR';
    const gameMode = getGameMode(modeKey);
    const category: Category = body.category || gameMode.category;

    const user = session.user as any;

    // Récupérer les infos complètes de l'utilisateur (verification + accounts)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { accounts: true }
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Déterminer le service et ID pour JKLM
    let authService = 'jklm';
    let authId = dbUser.jklmUsername || dbUser.name || 'Player';
    let authUsername = ''; // Pour le bot (cas JKLM)

    // Logique de priorité :
    // 1. Si vérifié JKLM : on utilise le pseudo JKLM (le bot matchera sur service='jklm' + username)
    // 2. Sinon si compte Discord : on utilise l'ID Discord (le bot matchera sur service='discord' + id)
    
    if (dbUser.isVerified && dbUser.jklmUsername) {
      authService = 'jklm';
      authUsername = dbUser.jklmUsername;
      // Ne PAS mettre l'ID car JKLM utilise un hash interne inconnu
      // Le bot matchera sur username uniquement
      authId = ''; 
    } else {
      // Chercher un compte oauth (Discord, Twitch...)
      const account = dbUser.accounts.find(a => a.providerId === 'discord') || dbUser.accounts[0];
      
      if (account) {
        authService = account.providerId; // 'discord', 'twitch'
        authId = account.accountId; // ID numérique Discord (ex: 5488...)
      }
    }

    console.log(`📥 [QUEUE] User ${user.id} auth: ${authService}:${authId}`);

    // Ajouter à la queue
    const entry = {
      userId: user.id,
      nickname: user.displayName || user.name || 'Player',
      authService,
      authId,
      authUsername,
      mmr: user.mmr || 1000,
      joinedAt: new Date()
    };

    const status = joinQueue(entry, category);

    // Vérifier si on peut lancer un match (timer expiré)
    if (canStartMatch(category) && isLobbyTimerExpired(category)) {
      clearLobbyTimer(category); // Nettoyer le timer avant de lancer le match
      
      const players = popPlayersForMatch(category);
      
      if (players.length >= 2) {
        // Lancer le bot et créer la room
        const roomCode = await createMatchWithBot(players, category, gameMode.rules);
        
        if (roomCode) {
          // Enregistrer le match en attente
          const match = registerPendingMatch(roomCode, players, category);
          
          return NextResponse.json({
            status: 'matched',
            roomCode,
            players: players.map(p => ({ nickname: p.nickname, mmr: p.mmr })),
            category
          });
        } else {
          // Échec de création de room - rollback
          cancelMatchingPlayers(players, category);
          console.error('❌ [QUEUE] Échec création room, joueurs remis en queue');
        }
      }
    }

    // Retourner le statut avec le countdown
    const updatedStatus = getQueueStatus(session.user.id);
    return NextResponse.json({
      status: 'waiting',
      position: updatedStatus.position,
      count: updatedStatus.count,
      countdown: updatedStatus.countdown,
      category
    });

  } catch (err) {
    console.error('❌ [QUEUE] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function createMatchWithBot(players: any[], category: Category, rules: { dictionaryId: string; scoreGoal?: number; challengeDuration?: number }): Promise<string | null> {
  return new Promise((resolve) => {
    const botScript = path.join(process.cwd(), 'jklm-bot/index.js');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/api/match/callback`;
    
    // Préparer les joueurs avec service + id/username au format JSON
    const playersData = players.map(p => ({
      service: p.authService,
      id: p.authId,
      username: p.authUsername // Ajout du username pour JKLM
    }));
    const playersJson = JSON.stringify(playersData);
    
    console.log(`🚀 [QUEUE] Création de match pour ${players.length} joueurs:`);
    players.forEach(p => console.log(`  - ${p.authService}:${p.authId} (${p.authUsername})`));

    const isDev = process.env.NODE_ENV === 'development';
    let isDetached = !isDev;
    if (process.env.BOT_DETACHED !== undefined) {
      isDetached = process.env.BOT_DETACHED === 'true';
    }

    const rulesJson = JSON.stringify(rules);

    const child = spawn('node', [botScript, '--create', callbackUrl, '--players-json', playersJson, '--rules', rulesJson, '--category', category], {
      detached: isDetached,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    const timeout = setTimeout(() => {
      console.log('⏰ [QUEUE] Timeout waiting for room code');
      resolve(null);
    }, 20000);

    child.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[BOT] ${output.trim()}`);
      const match = output.match(/Room cr..?e: ([A-Z]{4})/i);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`[BOT ERR] ${data.toString()}`);
    });

    if (isDetached) {
      child.unref();
    }
  });
}

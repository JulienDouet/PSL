import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getQueueStatus, getQueueCounts, canStartMatch, isLobbyTimerExpired, clearLobbyTimer, popPlayersForMatch, registerPendingMatch, cancelMatchingPlayers, heartbeat, startHeartbeatCleanup } from '@/lib/queue';
import { getGameMode } from '@/lib/game-modes';
import { spawn } from 'child_process';
import path from 'path';
import type { Category } from '@prisma/client';

// Démarrer le système de heartbeat au chargement du module
startHeartbeatCleanup();

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Heartbeat implicite à chaque polling
    heartbeat(session.user.id);

    let status = getQueueStatus(session.user.id);
    const counts = getQueueCounts();

    // Si en queue et timer expiré, déclencher le match
    console.log(`🔍 [DEBUG] status.inQueue=${status.inQueue}, category=${status.category}, canStart=${status.category ? canStartMatch(status.category) : 'N/A'}, timerExpired=${status.category ? isLobbyTimerExpired(status.category) : 'N/A'}`);
    
    if (status.inQueue && status.category && canStartMatch(status.category) && isLobbyTimerExpired(status.category)) {
      const category = status.category;
      console.log(`🎮 [QUEUE/STATUS] Timer expiré pour ${category}, lancement du match...`);
      clearLobbyTimer(category);
      
      const players = popPlayersForMatch(category);
      console.log(`👥 [QUEUE/STATUS] ${players.length} joueurs extraits pour le match`);
      
      if (players.length >= 2) {
        // Utiliser la catégorie du match pour les règles
        const gameMode = getGameMode(category as any);
        console.log(`⚙️ [QUEUE/STATUS] Mode de jeu: ${gameMode.label}, règles: ${JSON.stringify(gameMode.rules)}`);
        
        const result = await createMatchWithBot(players, category, gameMode.rules);
        
        if (result?.roomCode) {
          console.log(`✅ [QUEUE/STATUS] Match créé: ${result.roomCode}`);
          registerPendingMatch(result.roomCode, players, category, result.botPid);
        } else {
          console.log(`❌ [QUEUE/STATUS] Échec création match, remise en queue des joueurs`);
          cancelMatchingPlayers(players, category);
        }
      }
      
      // Refresh status after match creation
      status = getQueueStatus(session.user.id);
    }

    return NextResponse.json({
      ...status,
      queueCounts: counts
    });
  } catch (err) {
    console.error('❌ [QUEUE] Error getting status:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function createMatchWithBot(players: any[], category: Category, rules: { dictionaryId: string; scoreGoal?: number; challengeDuration?: number; tagOps?: any[] }): Promise<{ roomCode: string; botPid?: number } | null> {
  return new Promise((resolve) => {
    const botScript = path.join(process.cwd(), 'jklm-bot/index.js');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/api/match/callback`;
    
    const playersData = players.map(p => ({
      service: p.authService,
      id: p.authId,
      username: p.authUsername
    }));
    const playersJson = JSON.stringify(playersData);
    
    console.log(`🚀 [QUEUE/STATUS] Création de match pour ${players.length} joueurs`);

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

    const botPid = child.pid;

    const timeout = setTimeout(() => {
      console.log('⏰ [QUEUE/STATUS] Timeout waiting for room code');
      resolve(null);
    }, 20000);

    child.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[BOT] ${output.trim()}`);
      const match = output.match(/Room cr..?e: ([A-Z]{4})/i);
      if (match) {
        clearTimeout(timeout);
        resolve({ roomCode: match[1], botPid });
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

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getQueueStatus, getQueueCounts, canStartMatch, isLobbyTimerExpired, clearLobbyTimer, popPlayersForMatch, registerPendingMatch, cancelMatchingPlayers } from '@/lib/queue';
import { getGameMode } from '@/lib/game-modes';
import { spawn } from 'child_process';
import path from 'path';
import type { Category } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let status = getQueueStatus(session.user.id);
    const counts = getQueueCounts();

    // Si en queue et timer expiré, déclencher le match
    if (status.inQueue && status.category && canStartMatch(status.category) && isLobbyTimerExpired(status.category)) {
      const category = status.category;
      clearLobbyTimer(category);
      
      const players = popPlayersForMatch(category);
      if (players.length >= 2) {
        const gameMode = getGameMode('GP_FR'); // Default, idéalement on stockerait le mode
        const result = await createMatchWithBot(players, category, gameMode.rules);
        
        if (result?.roomCode) {
          registerPendingMatch(result.roomCode, players, category, result.botPid);
        } else {
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

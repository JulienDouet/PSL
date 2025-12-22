import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getQueueStatus, getQueueCounts, getQueuePlayers, canStartMatch, isLobbyTimerExpired, clearLobbyTimer, popPlayersForMatch, registerPendingMatch, cancelMatchingPlayers, heartbeat, startHeartbeatCleanup, QUEUE_CONFIG } from '@/lib/queue';
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
    
    if (status.inQueue && status.category && canStartMatch(status.category) && isLobbyTimerExpired(status.category)) {
      const category = status.category;
      clearLobbyTimer(category);
      
      const players = popPlayersForMatch(category);
      
      if (players.length >= 2) {
        const gameMode = getGameMode(category as any);
        
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

    // Enrichir les données des joueurs si un match existe
    let enrichedStatus: any = { ...status, queueCounts: counts, currentUserId: session.user.id };
    
    if (status.match && status.match.players.length > 0) {
      // Match créé - enrichir les joueurs du match
      const category = status.match.category;
      const enrichedPlayers = await enrichMatchPlayers(status.match.players, category);
      
      // Calculer le temps restant avant timeout du match (90s par défaut)
      const matchCreatedAt = new Date(status.match.createdAt);
      const elapsedMs = Date.now() - matchCreatedAt.getTime();
      const timeoutRemainingMs = QUEUE_CONFIG.MATCH_TIMEOUT_MS - elapsedMs;
      const matchTimeoutRemaining = Math.max(0, Math.ceil(timeoutRemainingMs / 1000));
      
      enrichedStatus = {
        ...enrichedStatus,
        match: {
          ...status.match,
          players: enrichedPlayers
        },
        matchTimeoutRemaining // Secondes restantes pour rejoindre le match
      };
    } else if (status.inQueue && status.category && status.countdown !== null) {
      // En queue avec countdown actif - renvoyer les joueurs en attente avec leurs stats
      const queuePlayers = getQueuePlayers(status.category);
      if (queuePlayers.length >= 2) {
        const enrichedQueuePlayers = await enrichMatchPlayers(queuePlayers, status.category);
        enrichedStatus.queuePlayers = enrichedQueuePlayers;
      }
    }

    return NextResponse.json(enrichedStatus);
  } catch (err) {
    console.error('❌ [QUEUE] Error getting status:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Enrichir les joueurs avec leurs stats pour le lobby pré-match
interface EnrichedPlayer {
  id: string; // userId pour identifier le joueur connecté
  nickname: string;
  mmr: number;
  gamesPlayed: number;
  winrate: number; // 0-100
  rank: number; // Position au leaderboard (1 = N°1)
  isTopRanked: boolean; // True si N°1 de la catégorie
}

async function enrichMatchPlayers(players: any[], category: Category): Promise<EnrichedPlayer[]> {
  // Récupérer tous les userIds
  const userIds = players.map(p => p.userId);
  
  // Récupérer les stats de catégorie pour ces joueurs
  const categoryStats = await prisma.userCategoryMMR.findMany({
    where: {
      userId: { in: userIds },
      category: category
    }
  });
  
  // Récupérer le nombre de wins par joueur dans cette catégorie
  const winsData = await prisma.matchPlayer.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      placement: 1,
      match: { category: category }
    },
    _count: { id: true }
  });
  const winsMap = new Map(winsData.map(w => [w.userId, w._count.id]));
  
  // Calculer les positions au leaderboard pour cette catégorie
  // On récupère tous les joueurs avec plus de 0 parties, triés par MMR décroissant
  const leaderboard = await prisma.userCategoryMMR.findMany({
    where: {
      category: category,
      gamesPlayed: { gt: 0 }
    },
    orderBy: { mmr: 'desc' },
    select: { userId: true }
  });
  const rankMap = new Map(leaderboard.map((entry, idx) => [entry.userId, idx + 1]));
  
  // Le N°1 de la catégorie
  const topRankedUserId = leaderboard.length > 0 ? leaderboard[0].userId : null;
  
  // Construire les données enrichies
  return players.map(p => {
    const stats = categoryStats.find(s => s.userId === p.userId);
    const gamesPlayed = stats?.gamesPlayed || 0;
    const wins = winsMap.get(p.userId) || 0;
    const winrate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    const rank = rankMap.get(p.userId) || 999;
    
    return {
      id: p.userId,
      nickname: p.nickname,
      mmr: p.mmr,
      gamesPlayed,
      winrate,
      rank,
      isTopRanked: p.userId === topRankedUserId
    };
  });
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

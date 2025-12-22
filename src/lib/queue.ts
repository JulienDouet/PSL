/**
 * Queue System for PSL Matchmaking
 * 
 * In-Memory implementation with multi-category support.
 * For V1/dev use. Will be replaced by Redis/DB for production.
 */

import type { Category } from '@prisma/client';

// ==========================================
// TYPES
// ==========================================

export interface QueueEntry {
  userId: string;
  nickname: string;
  authService: string;  // 'discord', 'twitch', 'jklm'
  authId: string;       // L'ID service (numérique pour Discord, pseudo pour JKLM si fallback)
  authUsername?: string; // Pseudo (pour JKLM/Guest)
  mmr: number;
  joinedAt: Date;
}

export interface MatchInfo {
  roomCode: string;
  players: QueueEntry[];
  category: Category;
  createdAt: Date;
  botPid?: number; // PID du processus bot pour le kill admin
}

export interface QueueStatus {
  inQueue: boolean;
  position: number;
  count: number;
  category: Category | null;
  match: MatchInfo | null; // Si match trouvé
  countdown: number | null; // Secondes restantes avant démarrage du match
}

// ==========================================
// STORAGE
// ==========================================

// Une queue par catégorie
const queues = new Map<Category, QueueEntry[]>();

// Matches en attente de joueurs (roomCode -> MatchInfo)
const pendingMatches = new Map<string, MatchInfo>();

// Mapping userId -> catégorie (pour savoir dans quelle queue le joueur est)
const userCategories = new Map<string, Category>();

// Mapping userId -> roomCode (si matché)
const userMatches = new Map<string, string>();

// Joueurs en cours de matching (entre popPlayersForMatch et registerPendingMatch)
// userId -> { players, category, matchingId }
interface MatchingState {
  matchingId: string;
  players: QueueEntry[];
  category: Category;
  createdAt: Date;
}
const matchingPlayers = new Map<string, MatchingState>();

// Timer de lobby par catégorie (démarre quand min_players atteint)
interface LobbyTimer {
  startedAt: Date;
  category: Category;
}
const lobbyTimers = new Map<Category, LobbyTimer>();

// Heartbeat pour détecter les joueurs inactifs
const userHeartbeats = new Map<string, Date>();

// Discord notifications: dernier ping par catégorie (cooldown)
const lastDiscordPing = new Map<Category, Date>();

// Timer pour notification Discord quand joueur seul
const soloNotifyTimers = new Map<Category, NodeJS.Timeout>();

// ==========================================
// CONFIG
// ==========================================

export const QUEUE_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  LOBBY_TIMER_MS: 30_000, // 30 secondes d'attente avant match
  MATCH_TIMEOUT_MS: 90_000, // 90s (pour V2)
  QUEUE_TIMEOUT_MS: 5 * 60_000, // 5 min inactif = kick
  HEARTBEAT_TIMEOUT_MS: 15_000, // 15 secondes sans heartbeat = joueur inactif
  DISCORD_JOIN_COOLDOWN_MS: 3 * 60_000, // 3 minutes entre deux pings pour queue join
};

// ==========================================
// QUEUE OPERATIONS
// ==========================================

/**
 * Ajoute un joueur à la queue pour une catégorie donnée.
 * @returns Le statut de la queue après ajout
 */
export function joinQueue(entry: QueueEntry, category: Category): QueueStatus {
  // Vérifier si déjà en queue
  if (userCategories.has(entry.userId)) {
    // Déjà en queue, retourner le statut actuel
    return getQueueStatus(entry.userId);
  }

  // Vérifier si déjà dans un match
  if (userMatches.has(entry.userId)) {
    return getQueueStatus(entry.userId);
  }

  // Initialiser la queue si nécessaire
  if (!queues.has(category)) {
    queues.set(category, []);
  }

  const queue = queues.get(category)!;
  queue.push(entry);
  userCategories.set(entry.userId, category);

  console.log(`🎮 [QUEUE] ${entry.nickname} rejoint la queue ${category} (${queue.length} joueurs)`);

  // Démarrer le timer de lobby si on atteint le minimum et timer pas encore actif
  if (queue.length >= QUEUE_CONFIG.MIN_PLAYERS && !lobbyTimers.has(category)) {
    lobbyTimers.set(category, {
      startedAt: new Date(),
      category
    });
    console.log(`⏱️ [QUEUE] Timer de lobby démarré pour ${category} (${QUEUE_CONFIG.LOBBY_TIMER_MS / 1000}s)`);
    
    // Notifier Discord que le match va bientôt commencer (PAS de cooldown)
    notifyDiscordMatchReady(category, queue.length);
  }
  
  // Notifier Discord quand un joueur rejoint (cooldown 3 min)
  notifyDiscordJoin(category, entry.nickname);

  return getQueueStatus(entry.userId);
}

/**
 * Retire un joueur de la queue.
 */
export function leaveQueue(userId: string): boolean {
  const category = userCategories.get(userId);
  if (!category) return false;

  const queue = queues.get(category);
  if (!queue) return false;

  const index = queue.findIndex(e => e.userId === userId);
  if (index === -1) return false;

  const [removed] = queue.splice(index, 1);
  userCategories.delete(userId);

  console.log(`👋 [QUEUE] ${removed.nickname} quitte la queue ${category} (${queue.length} restants)`);

  return true;
}

/**
 * Récupère le statut d'un joueur dans la queue.
 */
export function getQueueStatus(userId: string): QueueStatus {
  // Vérifier si le joueur est dans un match confirmé
  const matchRoomCode = userMatches.get(userId);
  if (matchRoomCode) {
    const match = pendingMatches.get(matchRoomCode);
    if (match) {
      return {
        inQueue: false,
        position: 0,
        count: 0,
        category: match.category,
        match: match,
        countdown: null
      };
    }
  }

  // Vérifier si le joueur est en cours de matching (room en création)
  const matchingState = matchingPlayers.get(userId);
  if (matchingState) {
    // Retourner un statut "matching" - le match est en préparation
    return {
      inQueue: false,
      position: 0,
      count: matchingState.players.length,
      category: matchingState.category,
      match: null,
      countdown: 0 // Match imminent
    };
  }

  // Vérifier si le joueur est en queue
  const category = userCategories.get(userId);
  if (!category) {
    return { inQueue: false, position: 0, count: 0, category: null, match: null, countdown: null };
  }

  const queue = queues.get(category);
  if (!queue) {
    return { inQueue: false, position: 0, count: 0, category: null, match: null, countdown: null };
  }

  const position = queue.findIndex(e => e.userId === userId) + 1;

  // Calculer le countdown si un timer est actif
  let countdown: number | null = null;
  const lobbyTimer = lobbyTimers.get(category);
  if (lobbyTimer) {
    const elapsed = Date.now() - lobbyTimer.startedAt.getTime();
    const remaining = Math.max(0, QUEUE_CONFIG.LOBBY_TIMER_MS - elapsed);
    countdown = Math.ceil(remaining / 1000); // En secondes
  }

  return {
    inQueue: true,
    position,
    count: queue.length,
    category,
    match: null,
    countdown
  };
}

/**
 * Vérifie si le timer de lobby est expiré pour une catégorie.
 */
export function isLobbyTimerExpired(category: Category): boolean {
  const timer = lobbyTimers.get(category);
  if (!timer) return false;
  
  const elapsed = Date.now() - timer.startedAt.getTime();
  return elapsed >= QUEUE_CONFIG.LOBBY_TIMER_MS;
}

/**
 * Nettoie le timer de lobby pour une catégorie.
 */
export function clearLobbyTimer(category: Category): void {
  lobbyTimers.delete(category);
  console.log(`🧹 [QUEUE] Timer de lobby nettoyé pour ${category}`);
}

/**
 * Vérifie si une catégorie a assez de joueurs pour un match.
 */
export function canStartMatch(category: Category): boolean {
  const queue = queues.get(category);
  return queue ? queue.length >= QUEUE_CONFIG.MIN_PLAYERS : false;
}

/**
 * Pop les joueurs pour un match et les marque comme "matching".
 * @returns Les joueurs retirés de la queue
 */
export function popPlayersForMatch(category: Category): QueueEntry[] {
  const queue = queues.get(category);
  if (!queue || queue.length < QUEUE_CONFIG.MIN_PLAYERS) {
    return [];
  }

  // Pour V1: on prend tous les joueurs en queue (jusqu'à MAX)
  const count = Math.min(queue.length, QUEUE_CONFIG.MAX_PLAYERS);
  const players = queue.splice(0, count);

  // Retirer de la map des catégories
  players.forEach(p => userCategories.delete(p.userId));

  // Marquer les joueurs comme "matching" (en cours de création de room)
  const matchingId = `matching_${Date.now()}`;
  const matchingState: MatchingState = {
    matchingId,
    players,
    category,
    createdAt: new Date()
  };
  players.forEach(p => matchingPlayers.set(p.userId, matchingState));

  console.log(`🎮 [QUEUE] Match créé avec ${players.length} joueurs pour ${category} (${matchingId})`);

  return players;
}

/**
 * Enregistre un match en attente de joueurs.
 * Nettoie l'état "matching" et passe les joueurs en "matched".
 */
export function registerPendingMatch(roomCode: string, players: QueueEntry[], category: Category, botPid?: number): MatchInfo {
  const match: MatchInfo = {
    roomCode,
    players,
    category,
    createdAt: new Date(),
    botPid
  };

  pendingMatches.set(roomCode, match);
  
  // Nettoyer l'état "matching" et passer en "matched"
  players.forEach(p => {
    matchingPlayers.delete(p.userId);
    userMatches.set(p.userId, roomCode);
  });

  console.log(`✅ [QUEUE] Match confirmé: ${roomCode} pour ${players.length} joueurs (botPid: ${botPid || 'N/A'})`);

  return match;
}

/**
 * Annule un matching en cours (si la création de room échoue).
 * Remet les joueurs dans la queue.
 */
export function cancelMatchingPlayers(players: QueueEntry[], category: Category): void {
  console.log(`❌ [QUEUE] Annulation du matching pour ${players.length} joueurs`);
  
  // Nettoyer l'état matching
  players.forEach(p => matchingPlayers.delete(p.userId));
  
  // Remettre les joueurs en queue
  if (!queues.has(category)) {
    queues.set(category, []);
  }
  const queue = queues.get(category)!;
  
  players.forEach(p => {
    queue.unshift(p); // Ajouter au début de la queue (priorité)
    userCategories.set(p.userId, category);
  });
  
  console.log(`🔄 [QUEUE] ${players.length} joueurs remis en queue ${category}`);
}

/**
 * Nettoie un match terminé.
 */
export function clearMatch(roomCode: string): void {
  const match = pendingMatches.get(roomCode);
  if (!match) return;

  match.players.forEach(p => userMatches.delete(p.userId));
  pendingMatches.delete(roomCode);
}

/**
 * Retourne le nombre de joueurs en queue par catégorie.
 */
export function getQueueCounts(): Record<Category, number> {
  const counts: Partial<Record<Category, number>> = {};

  for (const [category, queue] of queues.entries()) {
    counts[category] = queue.length;
  }

  return counts as Record<Category, number>;
}

/**
 * Retourne les joueurs actuellement en queue pour une catégorie.
 */
export function getQueuePlayers(category: Category): QueueEntry[] {
  return queues.get(category) || [];
}

// ==========================================
// ADMIN FUNCTIONS
// ==========================================

/**
 * Retourne tous les matchs actifs (pour le panel admin).
 */
export function getAllActiveMatches(): MatchInfo[] {
  return Array.from(pendingMatches.values());
}

/**
 * Tue un match et son bot associé (admin only).
 * Retourne le PID du bot tué, ou null si pas de bot.
 */
export function killMatch(roomCode: string): { success: boolean; botPid?: number } {
  const match = pendingMatches.get(roomCode);
  if (!match) {
    return { success: false };
  }

  const { botPid } = match;
  
  // Nettoyer le match
  match.players.forEach(p => userMatches.delete(p.userId));
  pendingMatches.delete(roomCode);
  
  console.log(`🔴 [ADMIN] Match ${roomCode} tué par admin (botPid: ${botPid || 'N/A'})`);
  
  return { success: true, botPid };
}

// ==========================================
// HEARTBEAT FUNCTIONS
// ==========================================

/**
 * Met à jour le heartbeat d'un joueur.
 * Appelé à chaque polling du frontend.
 */
export function heartbeat(userId: string): void {
  userHeartbeats.set(userId, new Date());
}

/**
 * Nettoie les joueurs inactifs (sans heartbeat récent).
 * @returns Le nombre de joueurs supprimés
 */
export function cleanupInactiveUsers(): number {
  const now = Date.now();
  let removed = 0;

  // Parcourir tous les joueurs en queue
  for (const [userId, category] of userCategories.entries()) {
    const lastBeat = userHeartbeats.get(userId);
    
    // Si pas de heartbeat ou heartbeat trop vieux
    if (!lastBeat || (now - lastBeat.getTime()) > QUEUE_CONFIG.HEARTBEAT_TIMEOUT_MS) {
      leaveQueue(userId);
      userHeartbeats.delete(userId);
      console.log(`💀 [HEARTBEAT] Joueur ${userId} retiré pour inactivité`);
      removed++;
    }
  }

  return removed;
}

/**
 * Démarre le nettoyage automatique des joueurs inactifs.
 * Appelé une fois au démarrage du serveur ou via un cron.
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startHeartbeatCleanup(): void {
  if (cleanupInterval) return; // Déjà démarré
  
  cleanupInterval = setInterval(() => {
    const removed = cleanupInactiveUsers();
    if (removed > 0) {
      console.log(`🧹 [HEARTBEAT] Cleanup: ${removed} joueur(s) inactif(s) retiré(s)`);
    }
  }, 5000); // Vérifier toutes les 5 secondes
  
  console.log('💓 [HEARTBEAT] Système de heartbeat démarré');
}

export function stopHeartbeatCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// ==========================================
// DISCORD NOTIFICATIONS
// ==========================================

/**
 * Envoie une notification Discord quand un joueur rejoint la queue.
 * Respecte le cooldown de 3 minutes.
 */
async function notifyDiscordJoin(category: Category, playerName: string): Promise<void> {
  // Vérifier le cooldown
  const lastPing = lastDiscordPing.get(category);
  const now = new Date();
  
  if (lastPing && (now.getTime() - lastPing.getTime()) < QUEUE_CONFIG.DISCORD_JOIN_COOLDOWN_MS) {
    const remainingMs = QUEUE_CONFIG.DISCORD_JOIN_COOLDOWN_MS - (now.getTime() - lastPing.getTime());
    console.log(`⏳ [DISCORD] Cooldown actif pour ${category}: ${Math.ceil(remainingMs / 1000)}s restantes`);
    return;
  }
  
  await sendDiscordNotification(category, playerName, 'join');
  lastDiscordPing.set(category, now);
}

/**
 * Envoie une notification Discord quand un match est sur le point de commencer.
 * PAS de cooldown - toujours envoyer.
 */
export async function notifyDiscordMatchReady(category: Category, playerCount: number): Promise<void> {
  await sendDiscordNotification(category, `${playerCount} joueurs`, 'match_ready');
}

/**
 * Fonction interne pour envoyer la notification Discord.
 */
async function sendDiscordNotification(category: Category, playerName: string, type: 'join' | 'match_ready'): Promise<void> {
  const webhookUrl = process.env.DISCORD_BOT_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('⚠️ [DISCORD] DISCORD_BOT_WEBHOOK_URL non configuré');
    return;
  }
  
  try {
    const queue = queues.get(category);
    const queueCount = queue?.length || 0;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        playerName,
        queueCount,
        type, // 'join' ou 'match_ready'
        secret: process.env.DISCORD_WEBHOOK_SECRET
      })
    });
    
    if (response.ok) {
      console.log(`✅ [DISCORD] Notification ${type} envoyée pour ${category} (${playerName})`);
    } else {
      console.error(`❌ [DISCORD] Erreur webhook: ${response.status}`);
    }
  } catch (err) {
    console.error('❌ [DISCORD] Erreur notification:', err);
  }
}


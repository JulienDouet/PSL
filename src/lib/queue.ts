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
}

export interface QueueStatus {
  inQueue: boolean;
  position: number;
  count: number;
  category: Category | null;
  match: MatchInfo | null; // Si match trouvé
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

// ==========================================
// CONFIG
// ==========================================

export const QUEUE_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  MATCH_TIMEOUT_MS: 90_000, // 90s (pour V2)
  QUEUE_TIMEOUT_MS: 5 * 60_000, // 5 min inactif = kick
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

  // Vérifier si on peut lancer un match
  if (queue.length >= QUEUE_CONFIG.MIN_PLAYERS) {
    // Pour V1: match instantané à 2 joueurs
    // Pour V2: on pourrait attendre un timer pour avoir plus de joueurs
    return { ...getQueueStatus(entry.userId), count: queue.length };
  }

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
  // Vérifier si le joueur est dans un match
  const matchRoomCode = userMatches.get(userId);
  if (matchRoomCode) {
    const match = pendingMatches.get(matchRoomCode);
    if (match) {
      return {
        inQueue: false,
        position: 0,
        count: 0,
        category: match.category,
        match: match
      };
    }
  }

  // Vérifier si le joueur est en queue
  const category = userCategories.get(userId);
  if (!category) {
    return { inQueue: false, position: 0, count: 0, category: null, match: null };
  }

  const queue = queues.get(category);
  if (!queue) {
    return { inQueue: false, position: 0, count: 0, category: null, match: null };
  }

  const position = queue.findIndex(e => e.userId === userId) + 1;

  return {
    inQueue: true,
    position,
    count: queue.length,
    category,
    match: null
  };
}

/**
 * Vérifie si une catégorie a assez de joueurs pour un match.
 */
export function canStartMatch(category: Category): boolean {
  const queue = queues.get(category);
  return queue ? queue.length >= QUEUE_CONFIG.MIN_PLAYERS : false;
}

/**
 * Pop les joueurs pour un match et les marque comme "en match".
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

  console.log(`🎮 [QUEUE] Match créé avec ${players.length} joueurs pour ${category}`);

  return players;
}

/**
 * Enregistre un match en attente de joueurs.
 */
export function registerPendingMatch(roomCode: string, players: QueueEntry[], category: Category): MatchInfo {
  const match: MatchInfo = {
    roomCode,
    players,
    category,
    createdAt: new Date()
  };

  pendingMatches.set(roomCode, match);
  players.forEach(p => userMatches.set(p.userId, roomCode));

  return match;
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

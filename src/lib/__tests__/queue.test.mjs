/**
 * Tests unitaires pour le système de queue PSL
 * Exécution: node --test src/lib/__tests__/queue.test.mjs
 */

import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';

// ==========================================
// STORAGE (simulation locale pour tests)
// ==========================================

let queues = new Map();
let pendingMatches = new Map();
let userCategories = new Map();
let userMatches = new Map();
let matchingPlayers = new Map();
let lobbyTimers = new Map();

const QUEUE_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  LOBBY_TIMER_MS: 10000,
};

function reset() {
  queues = new Map();
  pendingMatches = new Map();
  userCategories = new Map();
  userMatches = new Map();
  matchingPlayers = new Map();
  lobbyTimers = new Map();
}

// ==========================================
// FONCTIONS À TESTER
// ==========================================

function joinQueue(entry, category) {
  if (userCategories.has(entry.userId)) {
    return getQueueStatus(entry.userId);
  }
  if (userMatches.has(entry.userId)) {
    return getQueueStatus(entry.userId);
  }
  if (!queues.has(category)) {
    queues.set(category, []);
  }
  const queue = queues.get(category);
  queue.push(entry);
  userCategories.set(entry.userId, category);
  
  // Démarrer le timer si min_players atteint
  if (queue.length >= QUEUE_CONFIG.MIN_PLAYERS && !lobbyTimers.has(category)) {
    lobbyTimers.set(category, { startedAt: new Date(), category });
  }
  
  return getQueueStatus(entry.userId);
}

function leaveQueue(userId) {
  const category = userCategories.get(userId);
  if (!category) return false;
  
  const queue = queues.get(category);
  if (!queue) return false;
  
  const index = queue.findIndex(e => e.userId === userId);
  if (index === -1) return false;
  
  queue.splice(index, 1);
  userCategories.delete(userId);
  
  // Clear timer if queue drops below min
  if (queue.length < QUEUE_CONFIG.MIN_PLAYERS) {
    lobbyTimers.delete(category);
  }
  
  return true;
}

function getQueueStatus(userId) {
  const matchRoomCode = userMatches.get(userId);
  if (matchRoomCode) {
    const match = pendingMatches.get(matchRoomCode);
    if (match) {
      return { inQueue: false, position: 0, count: 0, category: match.category, match, countdown: null };
    }
  }

  const matchingState = matchingPlayers.get(userId);
  if (matchingState) {
    return {
      inQueue: false,
      position: 0,
      count: matchingState.players.length,
      category: matchingState.category,
      match: null,
      countdown: 0
    };
  }

  const category = userCategories.get(userId);
  if (!category) {
    return { inQueue: false, position: 0, count: 0, category: null, match: null, countdown: null };
  }
  const queue = queues.get(category);
  if (!queue) {
    return { inQueue: false, position: 0, count: 0, category: null, match: null, countdown: null };
  }
  const position = queue.findIndex(e => e.userId === userId) + 1;
  
  // Calculate countdown
  let countdown = null;
  const lobbyTimer = lobbyTimers.get(category);
  if (lobbyTimer) {
    const elapsed = Date.now() - lobbyTimer.startedAt.getTime();
    const remaining = Math.max(0, QUEUE_CONFIG.LOBBY_TIMER_MS - elapsed);
    countdown = Math.ceil(remaining / 1000);
  }
  
  return { inQueue: true, position, count: queue.length, category, match: null, countdown };
}

function isLobbyTimerExpired(category) {
  const timer = lobbyTimers.get(category);
  if (!timer) return false;
  const elapsed = Date.now() - timer.startedAt.getTime();
  return elapsed >= QUEUE_CONFIG.LOBBY_TIMER_MS;
}

function clearLobbyTimer(category) {
  lobbyTimers.delete(category);
}

function popPlayersForMatch(category) {
  const queue = queues.get(category);
  if (!queue || queue.length < QUEUE_CONFIG.MIN_PLAYERS) {
    return [];
  }
  const count = Math.min(queue.length, QUEUE_CONFIG.MAX_PLAYERS);
  const players = queue.splice(0, count);
  players.forEach(p => userCategories.delete(p.userId));

  const matchingId = `matching_${Date.now()}`;
  const matchingState = { matchingId, players, category, createdAt: new Date() };
  players.forEach(p => matchingPlayers.set(p.userId, matchingState));
  
  return players;
}

function registerPendingMatch(roomCode, players, category) {
  const match = { roomCode, players, category, createdAt: new Date() };
  pendingMatches.set(roomCode, match);
  players.forEach(p => {
    matchingPlayers.delete(p.userId);
    userMatches.set(p.userId, roomCode);
  });
  return match;
}

function cancelMatchingPlayers(players, category) {
  players.forEach(p => matchingPlayers.delete(p.userId));
  if (!queues.has(category)) {
    queues.set(category, []);
  }
  const queue = queues.get(category);
  players.forEach(p => {
    queue.unshift(p);
    userCategories.set(p.userId, category);
  });
}

// ==========================================
// HELPER
// ==========================================

function createEntry(id, nickname) {
  return {
    userId: id,
    nickname,
    authService: 'discord',
    authId: id,
    mmr: 1000,
    joinedAt: new Date()
  };
}

// ==========================================
// TESTS
// ==========================================

describe('Queue System', () => {
  beforeEach(() => {
    reset();
  });

  it('should add a player to queue', () => {
    const entry = createEntry('user1', 'Player1');
    const status = joinQueue(entry, 'GP');
    
    assert.equal(status.inQueue, true);
    assert.equal(status.position, 1);
    assert.equal(status.count, 1);
    assert.equal(status.category, 'GP');
    assert.equal(status.countdown, null);
  });

  it('should start lobby timer when 2 players join', () => {
    const entry1 = createEntry('user1', 'Player1');
    const entry2 = createEntry('user2', 'Player2');
    
    joinQueue(entry1, 'GP');
    assert.equal(lobbyTimers.has('GP'), false, 'Timer should not start with 1 player');
    
    joinQueue(entry2, 'GP');
    assert.equal(lobbyTimers.has('GP'), true, 'Timer should start with 2 players');
    
    const status = getQueueStatus('user1');
    assert.notEqual(status.countdown, null, 'Countdown should be set');
    assert.ok(status.countdown > 0, 'Countdown should be positive');
  });

  it('should mark players as matching after pop', () => {
    const entry1 = createEntry('user1', 'Player1');
    const entry2 = createEntry('user2', 'Player2');
    
    joinQueue(entry1, 'GP');
    joinQueue(entry2, 'GP');
    popPlayersForMatch('GP');
    
    const status1 = getQueueStatus('user1');
    const status2 = getQueueStatus('user2');
    
    assert.equal(status1.inQueue, false);
    assert.equal(status1.match, null);
    assert.equal(status1.countdown, 0);
    
    assert.equal(status2.inQueue, false);
    assert.equal(status2.match, null);
  });

  it('should confirm match after registerPendingMatch', () => {
    const entry1 = createEntry('user1', 'Player1');
    const entry2 = createEntry('user2', 'Player2');
    
    joinQueue(entry1, 'GP');
    joinQueue(entry2, 'GP');
    const players = popPlayersForMatch('GP');
    
    registerPendingMatch('ABCD', players, 'GP');
    
    const status1 = getQueueStatus('user1');
    const status2 = getQueueStatus('user2');
    
    assert.notEqual(status1.match, null);
    assert.equal(status1.match?.roomCode, 'ABCD');
    assert.notEqual(status2.match, null);
  });

  it('should rollback players if match creation fails', () => {
    const entry1 = createEntry('user1', 'Player1');
    const entry2 = createEntry('user2', 'Player2');
    
    joinQueue(entry1, 'GP');
    joinQueue(entry2, 'GP');
    const players = popPlayersForMatch('GP');
    
    cancelMatchingPlayers(players, 'GP');
    
    const status1 = getQueueStatus('user1');
    const status2 = getQueueStatus('user2');
    
    assert.equal(status1.inQueue, true);
    assert.equal(status2.inQueue, true);
  });

  it('should keep separate queues for different categories', () => {
    const entry1 = createEntry('user1', 'Player1');
    const entry2 = createEntry('user2', 'Player2');
    
    joinQueue(entry1, 'GP');
    joinQueue(entry2, 'ANIME');
    
    const status1 = getQueueStatus('user1');
    const status2 = getQueueStatus('user2');
    
    assert.equal(status1.category, 'GP');
    assert.equal(status2.category, 'ANIME');
    assert.equal(status1.count, 1);
    assert.equal(status2.count, 1);
  });

  it('should not add player already in queue', () => {
    const entry = createEntry('user1', 'Player1');
    
    joinQueue(entry, 'GP');
    const status2 = joinQueue(entry, 'GP');
    
    assert.equal(status2.count, 1, 'Should still be 1 player');
  });

  it('should remove player from queue on leave', () => {
    const entry1 = createEntry('user1', 'Player1');
    const entry2 = createEntry('user2', 'Player2');
    
    joinQueue(entry1, 'GP');
    joinQueue(entry2, 'GP');
    
    const left = leaveQueue('user1');
    assert.equal(left, true);
    
    const status = getQueueStatus('user2');
    assert.equal(status.count, 1);
    assert.equal(status.countdown, null, 'Timer should clear when below min');
  });

  it('should handle 3+ players in queue', () => {
    joinQueue(createEntry('user1', 'P1'), 'GP');
    joinQueue(createEntry('user2', 'P2'), 'GP');
    joinQueue(createEntry('user3', 'P3'), 'GP');
    
    const status = getQueueStatus('user3');
    assert.equal(status.count, 3);
    assert.equal(status.position, 3);
    
    const players = popPlayersForMatch('GP');
    assert.equal(players.length, 3, 'Should pop all 3 players');
  });

  it('should detect timer expired', () => {
    joinQueue(createEntry('user1', 'P1'), 'GP');
    joinQueue(createEntry('user2', 'P2'), 'GP');
    
    assert.equal(isLobbyTimerExpired('GP'), false);
    
    // Simulate time passing
    lobbyTimers.get('GP').startedAt = new Date(Date.now() - 15000);
    
    assert.equal(isLobbyTimerExpired('GP'), true);
  });
});


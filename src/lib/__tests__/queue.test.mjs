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

const QUEUE_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
};

function reset() {
  queues = new Map();
  pendingMatches = new Map();
  userCategories = new Map();
  userMatches = new Map();
  matchingPlayers = new Map();
}

// ==========================================
// FONCTIONS À TESTER (copie)
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
  
  if (queue.length >= QUEUE_CONFIG.MIN_PLAYERS) {
    return { ...getQueueStatus(entry.userId), count: queue.length };
  }
  return getQueueStatus(entry.userId);
}

function getQueueStatus(userId) {
  const matchRoomCode = userMatches.get(userId);
  if (matchRoomCode) {
    const match = pendingMatches.get(matchRoomCode);
    if (match) {
      return { inQueue: false, position: 0, count: 0, category: match.category, match };
    }
  }

  const matchingState = matchingPlayers.get(userId);
  if (matchingState) {
    return {
      inQueue: false,
      position: 0,
      count: matchingState.players.length,
      category: matchingState.category,
      match: null
    };
  }

  const category = userCategories.get(userId);
  if (!category) {
    return { inQueue: false, position: 0, count: 0, category: null, match: null };
  }
  const queue = queues.get(category);
  if (!queue) {
    return { inQueue: false, position: 0, count: 0, category: null, match: null };
  }
  const position = queue.findIndex(e => e.userId === userId) + 1;
  return { inQueue: true, position, count: queue.length, category, match: null };
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
  });

  it('should match when 2 players join', () => {
    const entry1 = createEntry('user1', 'Player1');
    const entry2 = createEntry('user2', 'Player2');
    
    joinQueue(entry1, 'GP');
    const status2 = joinQueue(entry2, 'GP');
    
    assert.equal(status2.count, 2, 'Queue should have 2 players');
    
    const players = popPlayersForMatch('GP');
    assert.equal(players.length, 2, 'Should pop 2 players');
    
    const queueAfter = queues.get('GP') || [];
    assert.equal(queueAfter.length, 0, 'Queue should be empty after pop');
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
    assert.equal(status1.match, null, 'Match not confirmed yet');
    assert.equal(status1.category, 'GP');
    
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
    
    assert.notEqual(status1.match, null, 'Player1 should have match');
    assert.equal(status1.match?.roomCode, 'ABCD');
    
    assert.notEqual(status2.match, null, 'Player2 should have match');
    assert.equal(status2.match?.roomCode, 'ABCD');
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
    
    assert.equal(status1.inQueue, true, 'Player1 should be back in queue');
    assert.equal(status2.inQueue, true, 'Player2 should be back in queue');
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
});

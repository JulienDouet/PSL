/**
 * JKLM.fun Solo Training Bot - PSL Bot - Training Mode
 * 
 * Single-process multi-session architecture for solo training.
 * Each user gets a private JKLM room with the bot.
 * 
 * Features:
 * - +10 fixed score per answer (time-independent)
 * - Bot answers after user (if known in DB)
 * - 3 difficulty modes: HARDCORE (5s), CHALLENGE (8s), NORMAL (12s)
 * - 5 min inactivity timeout
 * - Streak tracking with milestones (50, 100, 150...)
 */

import { io } from 'socket.io-client';
import crypto from 'crypto';

// Configuration
const CONFIG = {
  PHOENIX_URL: 'wss://phoenix.jklm.fun',
  BOT_NAME: 'PSL Bot - Training Mode',
  INACTIVITY_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  KEEPALIVE_INTERVAL: 30 * 1000, // 30 seconds
  SAVE_STATE_INTERVAL: 5, // Save every 5 questions
  MAX_CONCURRENT_SESSIONS: 50, // Soft limit
  MODES: {
    HARDCORE: { duration: 5, label: 'Hardcore' },
    CHALLENGE: { duration: 8, label: 'Challenge' },
    NORMAL: { duration: 12, label: 'Normal' }
  }
};

// Question cache (LRU-like)
const questionCache = new Map();
const CACHE_MAX_SIZE = 10000;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Active sessions
const activeSessions = new Map();
let peakSessions = 0;
let totalSessionsToday = 0;

/**
 * Solo Session class - manages a single user's training session
 */
class SoloSession {
  constructor(sessionId, userId, category, mode, callbackUrl) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.category = category;
    this.mode = mode;
    this.callbackUrl = callbackUrl;
    
    // Session state
    this.streak = 0;
    this.bestStreak = 0;
    this.questionsAsked = 0;
    this.roomCode = null;
    this.roomSocket = null;
    this.gameSocket = null;
    this.userToken = this.generateUserToken();
    this.selfPeerId = null;
    this.players = new Map();
    
    // Timing
    this.startedAt = Date.now();
    this.lastActivityAt = Date.now();
    this.keepaliveInterval = null;
    this.inactivityTimer = null;
    
    // Current question state
    this.currentChallenge = null;
    this.userAnswered = false;
    
    console.log(`🎯 [SOLO] New session ${sessionId} for user ${userId} | ${category} ${mode}`);
  }
  
  generateUserToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 16; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
  
  /**
   * Start the session - create room and join
   */
  async start() {
    try {
      // Create private room
      this.roomCode = await this.createRoom();
      console.log(`🏠 [SOLO-${this.sessionId}] Room created: ${this.roomCode}`);
      
      // Connect to room
      await this.connectToRoom();
      
      // Setup keepalive and timeout
      this.setupTimers();
      
      return {
        success: true,
        roomCode: this.roomCode,
        joinUrl: `https://jklm.fun/${this.roomCode}`
      };
    } catch (error) {
      console.error(`❌ [SOLO-${this.sessionId}] Start failed:`, error.message);
      this.cleanup();
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a private JKLM room
   */
  async createRoom() {
    const creatorUserToken = this.generateUserToken();
    const duration = CONFIG.MODES[this.mode]?.duration || 12;
    
    const res = await fetch('https://jklm.fun/api/startRoom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'PSL Solo Training',
        isPublic: false,
        gameId: 'popsauce',
        creatorUserToken
      })
    });
    
    const data = await res.json();
    if (!data.roomCode) throw new Error('Failed to create room');
    
    return data.roomCode;
  }
  
  /**
   * Connect to the JKLM room
   */
  async connectToRoom() {
    // Get room server
    const res = await fetch('https://jklm.fun/api/joinRoom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: this.roomCode })
    });
    
    const data = await res.json();
    if (!data.url) throw new Error('No server URL');
    
    const serverUrl = new URL(data.url);
    
    // Connect to room socket
    return new Promise((resolve, reject) => {
      this.roomSocket = io(`wss://${serverUrl.host}`, {
        path: '/socket.io',
        transports: ['websocket'],
        forceNew: true
      });
      
      this.roomSocket.on('connect', () => {
        console.log(`🔗 [SOLO-${this.sessionId}] Room socket connected`);
        this.roomSocket.emit('joinRoom', {
          roomCode: this.roomCode,
          userToken: this.userToken,
          nickname: CONFIG.BOT_NAME,
          language: 'fr-FR'
        });
      });
      
      this.roomSocket.on('joinedRoom', (roomData) => {
        console.log(`✅ [SOLO-${this.sessionId}] Joined room`);
        this.selfPeerId = roomData.selfPeerId;
        this.connectToGame(serverUrl.host).then(resolve).catch(reject);
      });
      
      this.roomSocket.on('connect_error', reject);
      this.roomSocket.on('error', reject);
    });
  }
  
  /**
   * Connect to game socket
   */
  async connectToGame(serverHost) {
    return new Promise((resolve, reject) => {
      this.gameSocket = io(`wss://${serverHost}`, {
        path: '/socket.io',
        transports: ['websocket'],
        forceNew: true
      });
      
      this.gameSocket.on('connect', () => {
        console.log(`🎮 [SOLO-${this.sessionId}] Game socket connected`);
        this.gameSocket.emit('joinGame', {
          gameId: 'popsauce',
          roomCode: this.roomCode,
          userToken: this.userToken
        });
      });
      
      this.gameSocket.on('joinedGame', () => {
        console.log(`✅ [SOLO-${this.sessionId}] Joined game`);
        this.setupGameHandlers();
        
        // Configure rules for solo mode
        this.configureRules();
        resolve();
      });
      
      this.gameSocket.on('connect_error', reject);
    });
  }
  
  /**
   * Configure game rules for this mode
   */
  configureRules() {
    const duration = CONFIG.MODES[this.mode]?.duration || 12;
    
    // Set challenge duration
    this.gameSocket.emit('setChallengeDuration', duration);
    
    // Set score goal high (so game doesn't end quickly)
    this.gameSocket.emit('setScoreGoal', 9999);
    
    // Lock rules
    this.gameSocket.emit('setRulesLocked', true);
    
    console.log(`⚙️ [SOLO-${this.sessionId}] Rules configured: ${duration}s per question`);
  }
  
  /**
   * Setup game event handlers
   */
  setupGameHandlers() {
    // Player joined
    this.gameSocket.on('addPlayer', (player) => {
      this.players.set(player.peerId, player);
      console.log(`👤 [SOLO-${this.sessionId}] Player joined: ${player.nickname}`);
      
      // Auto-start when user joins
      if (player.peerId !== this.selfPeerId) {
        this.lastActivityAt = Date.now();
        // Start game after short delay
        setTimeout(() => {
          this.gameSocket.emit('startRoundNow');
        }, 2000);
      }
    });
    
    // New challenge
    this.gameSocket.on('setChallenge', (challenge) => {
      this.currentChallenge = challenge;
      this.userAnswered = false;
      this.questionsAsked++;
      this.lastActivityAt = Date.now();
      
      console.log(`❓ [SOLO-${this.sessionId}] Q${this.questionsAsked}: ${challenge.prompt}`);
    });
    
    // Player answered
    this.gameSocket.on('setPlayerState', (data) => {
      if (data.state?.wasCorrect !== undefined && data.peerId !== this.selfPeerId) {
        // User answered
        this.userAnswered = true;
        this.lastActivityAt = Date.now();
        
        if (data.state.wasCorrect) {
          this.streak++;
          if (this.streak > this.bestStreak) {
            this.bestStreak = this.streak;
          }
          
          // Milestone announcements
          if (this.streak % 50 === 0) {
            this.sendChat(`🎯 ${this.streak}! 🔥`);
          }
          
          // Try to answer if we know it
          this.botAnswer();
        }
      }
    });
    
    // Challenge ended
    this.gameSocket.on('endChallenge', (result) => {
      // Check if user missed this question
      if (!this.userAnswered && this.streak > 0) {
        this.sendChat(`❌ Streak perdue à ${this.streak}!`);
        this.streak = 0;
      }
      
      // Save state periodically
      if (this.questionsAsked % CONFIG.SAVE_STATE_INTERVAL === 0) {
        this.saveState();
      }
      
      // Learn the question
      this.learnQuestion(result);
    });
    
    // Game milestone (winner)
    this.gameSocket.on('setMilestone', (milestone) => {
      // Solo mode shouldn't end normally, but handle it
      if (milestone.lastRound?.winner) {
        console.log(`🏆 [SOLO-${this.sessionId}] Game ended naturally`);
      }
    });
  }
  
  /**
   * Bot tries to answer if question is known
   */
  async botAnswer() {
    if (!this.currentChallenge) return;
    
    const hash = this.hashQuestion(this.currentChallenge);
    const answer = await this.lookupAnswer(hash);
    
    if (answer) {
      // Answer after user with slight delay
      setTimeout(() => {
        if (this.gameSocket?.connected) {
          this.gameSocket.emit('submitAnswer', answer);
          console.log(`🤖 [SOLO-${this.sessionId}] Bot answered: ${answer}`);
        }
      }, 100);
    }
  }
  
  /**
   * Hash a question for lookup
   */
  hashQuestion(challenge) {
    const content = challenge.text || challenge.imageHash || '';
    return crypto.createHash('sha256')
      .update(`${challenge.prompt}|${content}`)
      .digest('hex');
  }
  
  /**
   * Lookup answer in cache/DB
   */
  async lookupAnswer(hash) {
    // Check cache first
    if (questionCache.has(hash)) {
      const cached = questionCache.get(hash);
      if (Date.now() - cached.ts < CACHE_TTL) {
        return cached.answer;
      }
    }
    
    // TODO: Query PopsauceQuestion table
    // For now, return null (bot doesn't know)
    return null;
  }
  
  /**
   * Learn a question from the result
   */
  async learnQuestion(result) {
    if (!this.currentChallenge || !result.source) return;
    
    const hash = this.hashQuestion(this.currentChallenge);
    
    // Add to cache
    if (questionCache.size >= CACHE_MAX_SIZE) {
      // Remove oldest entry (simple eviction)
      const firstKey = questionCache.keys().next().value;
      questionCache.delete(firstKey);
    }
    
    questionCache.set(hash, {
      answer: result.source,
      ts: Date.now()
    });
    
    // TODO: Save to PopsauceQuestion table via callback
    console.log(`📚 [SOLO-${this.sessionId}] Learned: ${result.source}`);
  }
  
  /**
   * Save session state to DB
   */
  async saveState() {
    if (!this.callbackUrl) return;
    
    try {
      // POST to callback URL
      await fetch(`${this.callbackUrl}/api/solo/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'state_update',
          sessionId: this.sessionId,
          streak: this.streak,
          bestStreak: this.bestStreak,
          questionsAsked: this.questionsAsked
        })
      });
    } catch (err) {
      console.error(`❌ [SOLO-${this.sessionId}] Failed to save state:`, err.message);
    }
  }
  
  /**
   * Send chat message
   */
  sendChat(message) {
    if (this.roomSocket?.connected) {
      this.roomSocket.emit('chat', message);
    }
  }
  
  /**
   * Setup timers (keepalive, inactivity)
   */
  setupTimers() {
    // Keepalive ping
    this.keepaliveInterval = setInterval(() => {
      if (this.roomSocket?.connected) {
        this.roomSocket.emit('hello');
      }
    }, CONFIG.KEEPALIVE_INTERVAL);
    
    // Inactivity check
    this.inactivityTimer = setInterval(() => {
      if (Date.now() - this.lastActivityAt > CONFIG.INACTIVITY_TIMEOUT) {
        console.log(`⏰ [SOLO-${this.sessionId}] Timeout - 5 min inactivity`);
        this.end('TIMEOUT');
      }
    }, 60000);
  }
  
  /**
   * End the session
   */
  async end(reason = 'COMPLETED') {
    console.log(`🏁 [SOLO-${this.sessionId}] Ending: ${reason} | Streak: ${this.streak} | Best: ${this.bestStreak}`);
    
    // Notify via callback
    if (this.callbackUrl) {
      try {
        await fetch(`${this.callbackUrl}/api/solo/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'session_end',
            sessionId: this.sessionId,
            userId: this.userId,
            category: this.category,
            mode: this.mode,
            streak: this.streak,
            bestStreak: this.bestStreak,
            questionsAsked: this.questionsAsked,
            reason,
            duration: Date.now() - this.startedAt
          })
        });
      } catch (err) {
        console.error(`❌ [SOLO-${this.sessionId}] Failed to notify end:`, err.message);
      }
    }
    
    this.cleanup();
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.keepaliveInterval) clearInterval(this.keepaliveInterval);
    if (this.inactivityTimer) clearInterval(this.inactivityTimer);
    
    if (this.gameSocket) {
      this.gameSocket.disconnect();
      this.gameSocket = null;
    }
    
    if (this.roomSocket) {
      this.roomSocket.disconnect();
      this.roomSocket = null;
    }
    
    // Remove from active sessions
    activeSessions.delete(this.sessionId);
    
    console.log(`🧹 [SOLO-${this.sessionId}] Cleaned up | Active: ${activeSessions.size}`);
  }
}

// ===========================================
// API for session management
// ===========================================

/**
 * Start a new solo session
 */
export async function startSession(sessionId, userId, category, mode, callbackUrl) {
  // Check capacity
  if (activeSessions.size >= CONFIG.MAX_CONCURRENT_SESSIONS) {
    console.warn(`⚠️ [SOLO] At capacity: ${activeSessions.size} sessions`);
    // Still allow, but warn
  }
  
  const session = new SoloSession(sessionId, userId, category, mode, callbackUrl);
  activeSessions.set(sessionId, session);
  
  // Update metrics
  if (activeSessions.size > peakSessions) {
    peakSessions = activeSessions.size;
  }
  totalSessionsToday++;
  
  console.log(`📊 [SOLO] Active: ${activeSessions.size} | Peak: ${peakSessions} | Total today: ${totalSessionsToday}`);
  
  return session.start();
}

/**
 * End a session
 */
export function endSession(sessionId, reason = 'ABANDONED') {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.end(reason);
    return true;
  }
  return false;
}

/**
 * Get session status
 */
export function getSessionStatus(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;
  
  return {
    streak: session.streak,
    bestStreak: session.bestStreak,
    questionsAsked: session.questionsAsked,
    duration: Date.now() - session.startedAt,
    roomCode: session.roomCode
  };
}

/**
 * Get global stats
 */
export function getStats() {
  return {
    activeSessions: activeSessions.size,
    peakSessions,
    totalSessionsToday,
    cacheSize: questionCache.size
  };
}

// ===========================================
// Periodic cleanup of stale sessions
// ===========================================

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    // Force timeout after 8 hours (safety)
    if (now - session.startedAt > 8 * 60 * 60 * 1000) {
      console.log(`⚠️ [SOLO] Force killing session ${id} (8h limit)`);
      session.end('TIMEOUT');
    }
  }
}, 60 * 60 * 1000); // Check every hour

// Memory cleanup
setInterval(() => {
  for (const session of activeSessions.values()) {
    // Clear old player data
    if (session.players.size > 10) {
      session.players.clear();
    }
  }
  
  // Clean old cache entries
  const now = Date.now();
  for (const [hash, data] of questionCache) {
    if (now - data.ts > CACHE_TTL) {
      questionCache.delete(hash);
    }
  }
  
  console.log(`🧹 [SOLO] Memory cleanup | Cache: ${questionCache.size} | Sessions: ${activeSessions.size}`);
}, 10 * 60 * 1000); // Every 10 min

console.log('🎯 Solo Bot initialized - Ready to accept sessions');

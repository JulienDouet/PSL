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
   * Start the session - create room and join using JKLMBot class from ranked bot
   */
  async start() {
    try {
      // Import the working JKLMBot class
      const { JKLMBot } = await import('./index.js');
      
      // Create a bot instance
      this.bot = new JKLMBot();
      
      // Create private room (like test-mode in ranked bot)
      console.log(`🏗️ [SOLO-${this.sessionId}] Creating room using JKLMBot...`);
      const result = await this.bot.createRoom({ 
        name: 'PSL Solo Training', 
        isPublic: false 
      });
      this.roomCode = result.roomCode;
      console.log(`🏠 [SOLO-${this.sessionId}] Room created: ${this.roomCode}`);
      
      // 🔥 IMMEDIATELY notify API that room is created (don't wait for full connection)
      if (this.callbackUrl) {
        const callbackPayload = {
          type: 'room_created',
          sessionId: this.sessionId,
          roomCode: this.roomCode,
          joinUrl: `https://jklm.fun/${this.roomCode}`
        };
        console.log(`📤 [SOLO-${this.sessionId}] Sending room_created callback...`);
        
        fetch(`${this.callbackUrl}/api/solo/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(callbackPayload)
        })
          .then(res => {
            console.log(`📥 [SOLO-${this.sessionId}] Callback response: ${res.status}`);
            return res.json().catch(() => ({}));
          })
          .then(data => console.log(`📥 [SOLO-${this.sessionId}] Callback data:`, JSON.stringify(data)))
          .catch(err => console.error(`❌ [SOLO-${this.sessionId}] Callback failed:`, err.message));
      }
      
      // Connect to room using the working JKLMBot.connect() method
      console.log(`🔌 [SOLO-${this.sessionId}] Connecting to room using JKLMBot.connect()...`);
      await this.bot.connect(this.roomCode, { 
        nickname: CONFIG.BOT_NAME 
      });
      console.log(`✅ [SOLO-${this.sessionId}] Connected to room!`);
      
      // Store references
      this.roomSocket = this.bot.roomSocket;
      this.gameSocket = this.bot.gameSocket;
      this.selfPeerId = this.bot.selfPeerId;
      
      // Configure rules for solo mode
      this.configureRules();
      
      // Setup keepalive and timeout
      this.setupTimers();
      
      // Setup solo-specific game handlers
      this.setupSoloGameHandlers();
      
      return {
        success: true,
        roomCode: this.roomCode,
        joinUrl: `https://jklm.fun/${this.roomCode}`
      };
    } catch (error) {
      console.error(`❌ [SOLO-${this.sessionId}] Start failed:`, error.message);
      console.error(error.stack);
      this.cleanup();
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Setup solo-specific game handlers
   */
  setupSoloGameHandlers() {
    if (!this.gameSocket) return;
    
    // Player joined
    this.gameSocket.on('addPlayer', (player) => {
      this.players.set(player.peerId, player);
      console.log(`👤 [SOLO-${this.sessionId}] Player joined: ${player.nickname}`);
      
      // Auto-start when user joins
      if (player.peerId !== this.selfPeerId) {
        this.lastActivityAt = Date.now();
        // Start game after short delay
        setTimeout(() => {
          if (this.gameSocket?.connected) {
            console.log(`🚀 [SOLO-${this.sessionId}] Starting game...`);
            this.gameSocket.emit('startRoundNow');
          }
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
  }
  
  /**
   * Connect to game socket - EXACT same as ranked bot's connectToGame
   */
  connectToGame(serverHost, roomCode, nickname) {
    // Étape 2: Connexion au jeu Popsauce sur le MÊME serveur
    const socketUrl = `wss://${serverHost}`;
    this.gameSocket = io(socketUrl, {
      transports: ['websocket'],
      path: '/socket.io/',
      query: { EIO: '4', transport: 'websocket' },
    });

    this.gameSocket.on('connect', () => {
      console.log(`✅ [SOLO-${this.sessionId}] Connecté à ${serverHost} (game)`);
      
      // Format: joinGame(gameType, roomCode, userToken) - EXACT same format as ranked bot
      console.log(`📤 [SOLO-${this.sessionId}] Envoi joinGame...`);
      this.gameSocket.emit('joinGame', 'popsauce', roomCode, this.userToken);
    });

    // Écouter les events du jeu - use 'setup' like ranked bot, not 'joinedGame'
    this.gameSocket.on('setup', (data) => {
      console.log(`📋 [SOLO-${this.sessionId}] [SETUP] Setup reçu!`);
      console.log(`📋 [SOLO-${this.sessionId}] [SETUP] selfPeerId: ${data.selfPeerId}`);
      console.log(`📋 [SOLO-${this.sessionId}] [SETUP] selfRoles: ${JSON.stringify(data.selfRoles)}`);
      this.selfPeerId = data.selfPeerId;
      this.isLeader = data.selfRoles && data.selfRoles.includes('leader');
      console.log(`📋 [SOLO-${this.sessionId}] [SETUP] isLeader: ${this.isLeader}`);
      
      // Setup game handlers and configure rules
      this.setupGameHandlers();
      this.configureRules();
    });

    // Debug: log all game events
    this.gameSocket.onAny((event, ...args) => {
      if (!['setPlayerState'].includes(event)) {
        console.log(`📥 [SOLO-${this.sessionId}] [GAME] ${event}:`, JSON.stringify(args).substring(0, 100));
      }
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

// ===========================================
// CLI Entry Point - for spawning from API
// ===========================================
// Usage: node solo-bot.js --session <id> --user <id> --category <cat> --mode <mode> --callback <url>

const args = process.argv.slice(2);

if (args.includes('--session')) {
  const sessionIdx = args.indexOf('--session');
  const userIdx = args.indexOf('--user');
  const categoryIdx = args.indexOf('--category');
  const modeIdx = args.indexOf('--mode');
  const callbackIdx = args.indexOf('--callback');
  
  const sessionId = args[sessionIdx + 1];
  const userId = args[userIdx + 1];
  const category = args[categoryIdx + 1];
  const mode = args[modeIdx + 1] || 'NORMAL';
  const callbackUrl = args[callbackIdx + 1] || 'https://psl-ranked.app';
  
  console.log(`🚀 [SOLO-CLI] Starting session via CLI:`);
  console.log(`  Session: ${sessionId}`);
  console.log(`  User: ${userId}`);
  console.log(`  Category: ${category}`);
  console.log(`  Mode: ${mode}`);
  console.log(`  Callback: ${callbackUrl}`);
  
  // Start the session
  startSession(sessionId, userId, category, mode, callbackUrl)
    .then((result) => {
      if (result.success) {
        // CRITICAL: Print room code so API can capture it
        console.log(`Room créée: ${result.roomCode}`);
        
        // Notify API via callback
        const callbackPayload = {
          type: 'room_created',
          sessionId,
          roomCode: result.roomCode,
          joinUrl: result.joinUrl
        };
        console.log(`📤 [SOLO-CLI] Sending callback to ${callbackUrl}/api/solo/callback`);
        
        fetch(`${callbackUrl}/api/solo/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(callbackPayload)
        })
          .then(res => {
            console.log(`📥 [SOLO-CLI] Callback response: ${res.status} ${res.statusText}`);
            return res.json().catch(() => ({}));
          })
          .then(data => {
            console.log(`📥 [SOLO-CLI] Callback data:`, JSON.stringify(data));
          })
          .catch(err => {
            console.error(`❌ [SOLO-CLI] Callback failed:`, err.message);
          });
        
        // Keep process alive
        console.log('✅ Session started - keeping process alive...');
      } else {
        console.error('❌ Failed to start session:', result.error);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('❌ Fatal error:', err);
      process.exit(1);
    });
}

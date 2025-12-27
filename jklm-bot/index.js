/**
 * JKLM.fun Popsauce Bot - POC v3
 * 
 * Basé sur l'analyse HAR complète
 * 
 * JKLM utilise 2 connexions WebSocket:
 * 1. phoenix.jklm.fun - joinRoom (lobby)
 * 2. phoenix.jklm.fun - joinGame (popsauce game)
 */

import { io } from 'socket.io-client';
import crypto from 'crypto';

// URL correcte découverte dans le HAR
const PHOENIX_URL = 'wss://phoenix.jklm.fun';

class JKLMBot {
  constructor() {
    this.roomSocket = null;  // Connexion lobby
    this.gameSocket = null;  // Connexion jeu
    this.roomCode = null;
    this.userToken = null;
    this.players = new Map();
    this.gameResults = [];
    this.matchAnswers = []; // Stockage des réponses timecode
    this.currentChallenge = null;
    this.roundCounter = 0;
    this.selfPeerId = null;
    this.expectedPlayers = []; // Liste des joueurs attendus
    this.allPlayersJoined = false;
    this.isLeader = false;
    this.verifyMode = false; // Mode vérification JKLM
    this.verifyCode = null;  // Code à attendre
    this.callbackUrl = null;
    this.customRules = null; // Règles personnalisées (dictionaryId, scoreGoal, challengeDuration)
    this.category = 'GP';   // Catégorie du match (pour le callback)
    this.startedAt = null;  // Timestamp de début du match (passé par --started-at)
    
    // Test mode for admin panel
    this.testMode = false;
    this.logBuffer = [];    // Buffer for SSE streaming
    this.httpServer = null; // HTTP server for log streaming
    
    // Solo mode properties
    this.soloMode = false;
    this.soloModeType = null;  // HARDCORE / CHALLENGE / NORMAL
    this.soloGameStarted = false;
    this.sessionId = null;
    this.userId = null;
    this.soloStreak = 0;       // Current consecutive correct answers
    this.soloBestStreak = 0;   // Best streak this session
  }
  
  // Structured logging with levels (for test mode streaming)
  log(level, ...args) {
    const message = args.join(' ');
    const logEntry = {
      ts: Date.now(),
      level,
      msg: message
    };
    
    // Always console.log
    const prefix = level === 'DEBUG' ? '🔍' : level === 'PLAYER' ? '👤' : level === 'AUTH' ? '🔐' : 'ℹ️';
    console.log(`${prefix} [${level}] ${message}`);
    
    // Buffer for SSE streaming in test mode
    if (this.testMode && this.logBuffer) {
      this.logBuffer.push(logEntry);
    }
  }

  generateUserToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 16; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  async getRoomServer(roomCode) {
    try {
      const response = await fetch('https://jklm.fun/api/joinRoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode })
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data.errorCode) throw new Error(data.errorCode);
      if (!data.url) throw new Error('No URL in response');
      
      const url = new URL(data.url);
      console.log(`🌐 Serveur trouvé: ${url.host}`);
      return url.host;
    } catch (error) {
      console.error('❌ Erreur lookup room:', error.message);
      throw error;
    }
  }

  async createRoom(options = {}) {
    const name = options.name || 'PSL Match';
    const isPublic = options.isPublic ?? false;
    const gameId = options.gameId || 'popsauce';
    const creatorUserToken = this.generateUserToken();
    
    console.log(`🏗️ Création d'une room "${name}" (${gameId})...`);
    
    const payload = { name, isPublic, gameId, creatorUserToken };
    console.log('📤 Payload envoyé à JKLM:', JSON.stringify(payload));
    
    try {
      const response = await fetch('https://jklm.fun/api/startRoom', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error('❌ Réponse erreur JKLM:', errorBody);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      console.log('📦 Réponse startRoom:', JSON.stringify(data, null, 2));
      
      if (data.errorCode) throw new Error(data.errorCode);
      if (!data.url) throw new Error('No URL in response');
      
      // Le code room peut être dans data.roomCode OU dans l'URL
      let roomCode = data.roomCode;
      if (!roomCode && data.url) {
        // Essayer d'extraire depuis l'URL (ex: https://jklm.fun/ABCD)
        const parts = data.url.split('/');
        roomCode = parts[parts.length - 1];
      }
      
      if (!roomCode) throw new Error('Could not extract room code');
      
      console.log(`✅ Room créée: ${roomCode}`);
      console.log(`🔗 URL: ${data.url}`);
      
      // Stocker le token créateur pour pouvoir rejoindre comme leader
      this.userToken = creatorUserToken;
      
      return { roomCode, url: data.url };
    } catch (error) {
      console.error('❌ Erreur création room:', error.message);
      throw error;
    }
  }

  async connect(roomCode, options = {}) {
    this.roomCode = roomCode.toUpperCase();
    this.userToken = options.userToken || this.userToken || this.generateUserToken();

    const nickname = options.nickname || 'PSL-Bot';
    const language = options.language || 'fr-FR';
    this.callbackUrl = options.callbackUrl;

    console.log(`🎮 Recherche du serveur pour le lobby ${this.roomCode}...`);

    try {
        const serverHost = await this.getRoomServer(this.roomCode);
        const socketUrl = `wss://${serverHost}`;

        console.log(`🔌 Connexion WebSocket vers ${socketUrl}...`);

        // Étape 1: Connexion au lobby (room)
        return new Promise((resolve, reject) => {
          this.roomSocket = io(socketUrl, {
            transports: ['websocket'],
            path: '/socket.io/',
            query: { EIO: '4', transport: 'websocket' },
            extraHeaders: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });

          this.roomSocket.on('connect', () => {
            console.log(`✅ Connecté à ${serverHost} (room)`);
            
            // Envoyer joinRoom avec callback (Ack)
            const joinData = {
              roomCode,
              userToken: this.userToken,
              nickname,
              language,
            };

            console.log('📤 Envoi joinRoom:', roomCode);
            this.roomSocket.emit('joinRoom', joinData, (response) => {
               console.log('📥 [ROOM] Ack reçu:', response);
               if (response && (response.roomEntry || response[0]?.roomEntry)) {
                 console.log('✅ Lobby rejoint (Ack), connexion au jeu...');
                 this.connectToGame(serverHost, roomCode, nickname);
                 resolve();
               } else {
                 console.error('❌ Échec joinRoom (Ack vide/invalide)');
               }
            });
          });

          // Écouter tous les events (debug)
          this.roomSocket.onAny((event, ...args) => {
            console.log(`📥 [ROOM] ${event}:`, JSON.stringify(args).substring(0, 150));
          });

          // Écouter les messages chat (pour mode vérification)
          this.roomSocket.on('chat', (sender, message) => {
            // Le premier argument 'sender' est un objet: { nickname: 'Pseudo', auth: { service, username, id }, ... }
            console.log('💬 [CHAT] Sender:', JSON.stringify(sender));
            const nick = (typeof sender === 'object' && sender) ? sender.nickname : sender;
            console.log(`💬 [CHAT] ${nick}: ${message}`);
            this.handleChatMessage(sender, message);
          });

          // Écouter quand un joueur rejoint le LOBBY (pas le jeu)
          this.roomSocket.on('chatterAdded', (chatter) => {
            // Format: { nickname: "...", peerId: N, auth: { service: "discord", username: "...", id: "..." } }
            console.log(`👋 [LOBBY] Joueur au lobby:`, JSON.stringify(chatter));
            
            const nick = chatter.nickname;
            const auth = chatter.auth;
            
            // === DEBUG: Log détaillé pour JKLM staff (service=jklm) ===
            if (auth?.service === 'jklm') {
              console.log(`🔍 [DEBUG-JKLM-STAFF] Compte JKLM détecté au lobby:`);
              console.log(`   - nickname (affiché): "${nick}"`);
              console.log(`   - auth.username (permanent): "${auth.username || 'N/A'}"`);
              console.log(`   - auth.id: "${auth.id || 'N/A'}"`);
              console.log(`   - auth complet:`, JSON.stringify(auth));
            }
            
            // Message de bienvenue au lobby selon si le joueur est inscrit ou non
            if (this.expectedPlayers.length > 0) {
              const isExpected = this.findExpectedPlayer(nick, auth);
              const connectedCount = this.countConnectedExpectedPlayers();
              const totalExpected = this.expectedPlayers.length;
              
              // === DEBUG: Log si le joueur n'était pas dans la queue ===
              if (!isExpected) {
                console.log(`⚠️ [QUEUE] Joueur NON ATTENDU au lobby: "${nick}"`);
                console.log(`   - auth: ${auth ? JSON.stringify(auth) : 'null (guest)'}`); 
                console.log(`   - Joueurs attendus (${totalExpected}):`);
                this.expectedPlayers.forEach(p => console.log(`     - ${p.service}:${p.id || p.username}`));
              }
              
              if (isExpected) {
                // Joueur inscrit et attendu - seulement le compter, pas encore de message
                // Le message sera envoyé quand il rejoindra la partie (addPlayer)
                console.log(`✅ [LOBBY] ${nick} est inscrit (en attente qu'il rejoigne la partie)`);
              } else {
                // Joueur non inscrit - l'informer immédiatement (langue selon dictionaryId)
                const isEnglish = this.customRules?.dictionaryId === 'en';
                const welcomeMsg = isEnglish 
                  ? `📊 ${nick}, this is a PSL ranked match. Sign up at www.psl-ranked.app for your points to count! Join our Discord: discord.gg/JGHRNy6qRn`
                  : `📊 ${nick}, cette partie est un match classé PSL. Inscris-toi sur www.psl-ranked.app pour que tes points comptent ! Rejoins le Discord : discord.gg/JGHRNy6qRn`;
                this.sendChat(welcomeMsg);
              }
            }
          });

          this.roomSocket.on('connect_error', (err) => {
            console.error('❌ Erreur room:', err.message);
            reject(err);
          });
        });
    } catch (err) {
        console.error('❌ Impossible de trouver/rejoindre le lobby:', err);
    }
  }

  connectToGame(serverHost, roomCode, nickname) {
    // Étape 2: Connexion au jeu Popsauce sur le MÊME serveur
    const socketUrl = `wss://${serverHost}`;
    this.gameSocket = io(socketUrl, {
      transports: ['websocket'],
      path: '/socket.io/',
      query: { EIO: '4', transport: 'websocket' },
    });

    this.gameSocket.on('connect', () => {
      console.log('✅ Connecté à phoenix.jklm.fun (game)');
      
      // Format: joinGame(gameType, roomCode, userToken)
      console.log('📤 Envoi joinGame...');
      this.gameSocket.emit('joinGame', 'popsauce', roomCode, this.userToken);
    });

    // Écouter les events du jeu
    this.gameSocket.on('setup', (data) => {
      console.log('📋 [SETUP] Setup reçu!');
      console.log(`📋 [SETUP] selfPeerId: ${data.selfPeerId}`);
      console.log(`📋 [SETUP] selfRoles: ${JSON.stringify(data.selfRoles)}`);
      this.selfPeerId = data.selfPeerId;
      this.isLeader = data.selfRoles && data.selfRoles.includes('leader');
      console.log(`📋 [SETUP] isLeader déterminé: ${this.isLeader}`);
      // IMPORTANT: On ne rejoint PAS la manche pour rester spectateur
      // this.gameSocket.emit('joinRound');

      // Si on est leader, configurer les règles PSL
      if (this.isLeader) {
         console.log('👑 Je suis LEADER!');
         
         // === SOLO MODE ===
         if (this.soloMode) {
           console.log('🎯 [SOLO] Configuration du mode solo...');
           
           // DON'T apply rules yet - wait for player to join
           // The rules will be applied right before starting
           
           // Listen for player joining to auto-start
           this.gameSocket.on('addPlayer', (player) => {
             // Ignore self
             if (player.peerId === this.selfPeerId) return;
             
             const nickname = player.profile?.nickname || `Player${player.peerId}`;
             console.log(`👤 [SOLO] Joueur rejoint: ${nickname}`);
             this.players.set(player.peerId, {
               nickname: nickname,
               peerId: player.peerId,
               auth: player.profile?.auth || null,
               score: 0
             });
             
             // Auto-start game when player joins
             if (!this.soloGameStarted) {
               this.soloGameStarted = true;
               console.log('🚀 [SOLO] Préparation de la partie...');
               
               // STEP 1: Apply rules FIRST (before joining round)
               console.log('� [SOLO] Application des règles avant de rejoindre...');
               this.applySoloRulesSync();
               
               // STEP 2: Wait for rules to be processed, THEN join round
               setTimeout(() => {
                 if (!this.gameSocket?.connected) return;
                 
                 console.log('📤 [SOLO] joinRound envoyé (bot devient participant)');
                 this.gameSocket.emit('joinRound');
                 
                 // STEP 3: Let the natural countdown run (no startRoundNow needed)
                 console.log('⏳ [SOLO] Countdown naturel en cours...');
               }, 1000);  // 1s delay for rules to be processed
             }
           });
           
           return;  // Skip ranked mode logic
         }
         
         // === RANKED MODE ===
         // Si on attend des joueurs, verrouiller les règles pour empêcher le démarrage
         if (this.expectedPlayers.length > 0) {
             console.log('🔒 Verrouillage des règles (en attente de joueurs)...');
             this.gameSocket.emit('setRulesLocked', false); // false = menu ouvert = bloque le jeu
             
             // Timer de 60s pour forcer le démarrage même si certains joueurs manquent
             // Avec messages d'avertissement à 30s et 50s
             const isEnglish = this.customRules?.dictionaryId === 'en';
             
             // Message à 30 secondes
             this.warningTimeout30 = setTimeout(() => {
                 if (!this.allPlayersJoined && this.gameSocket?.connected) {
                     const connectedCount = this.countConnectedExpectedPlayers();
                     const totalExpected = this.expectedPlayers.length;
                     const msg = isEnglish
                       ? `⏳ 30 seconds remaining... (${connectedCount}/${totalExpected} players)`
                       : `⏳ 30 secondes restantes... (${connectedCount}/${totalExpected} joueurs)`;
                     this.sendChat(msg);
                 }
             }, 30_000);
             
             // Message à 50 secondes (10s avant fin)
             this.warningTimeout50 = setTimeout(() => {
                 if (!this.allPlayersJoined && this.gameSocket?.connected) {
                     const connectedCount = this.countConnectedExpectedPlayers();
                     const totalExpected = this.expectedPlayers.length;
                     const msg = isEnglish
                       ? `⚠️ 10 seconds remaining! (${connectedCount}/${totalExpected} players)`
                       : `⚠️ 10 secondes restantes ! (${connectedCount}/${totalExpected} joueurs)`;
                     this.sendChat(msg);
                 }
             }, 50_000);
             
             // Timeout final à 60 secondes
             this.lobbyTimeout = setTimeout(() => {
                 if (!this.allPlayersJoined && this.gameSocket?.connected && this.isLeader) {
                     const connectedCount = this.countConnectedExpectedPlayers();
                     const totalExpected = this.expectedPlayers.length;
                     
                     // Vérifier qu'il y a au moins 2 joueurs pour démarrer
                     if (connectedCount < 2) {
                         console.log(`❌ [TIMEOUT] Match annulé - seulement ${connectedCount} joueur(s) présent(s)`);
                         const cancelMsg = isEnglish
                           ? `❌ Match cancelled - not enough players (${connectedCount}/${totalExpected})`
                           : `❌ Match annulé - pas assez de joueurs (${connectedCount}/${totalExpected})`;
                         this.sendChat(cancelMsg);
                         
                         // Envoyer le callback d'annulation
                         this.cancelMatch('timeout_not_enough_players');
                         return;
                     }
                     
                     console.log(`⏰ [TIMEOUT] Démarrage forcé après 60s (${connectedCount}/${totalExpected} joueurs présents)`);
                     const startMsg = isEnglish
                       ? `⏰ Timeout! Starting with ${connectedCount}/${totalExpected} players...`
                       : `⏰ Timeout ! Démarrage avec ${connectedCount}/${totalExpected} joueurs...`;
                     this.sendChat(startMsg);
                     
                     this.allPlayersJoined = true; // Empêcher le démarrage normal
                     console.log('🔓 Déverrouillage des règles (timeout)...');
                     this.gameSocket.emit('setRulesLocked', true);
                     console.log('📤 Envoi startRoundNow (timeout)...');
                     this.gameSocket.emit('startRoundNow');
                 }
             }, 60_000); // 60 secondes
         }
         
         // Appliquer les règles PSL après un court délai
         setTimeout(() => {
           this.applyRules();
         }, 500);
         
          // Si pas de joueurs attendus (test mode), laisser le countdown naturel
          if (this.expectedPlayers.length === 0) {
              setTimeout(() => {
                  console.log('ℹ️ Pas de joueurs attendus, attente du countdown naturel...');
                  // this.gameSocket.emit('startRoundNow'); // DISABLED - let countdown finish
              }, 3000);
          }
      }

      if (data.players) {
        data.players.forEach(p => {
          const auth = p.profile?.auth || p.auth || null;
          this.players.set(p.peerId, {
            nickname: p.profile?.nickname || `Player${p.peerId}`,
            peerId: p.peerId,
            auth: auth,  // ✅ Capture auth for existing players too!
            score: 0,
          });
          
          // Log if auth is present
          if (auth) {
            console.log(`👤 [setPlayers] ${p.profile?.nickname} avec auth: ${auth.service}:${auth.username || auth.id}`);
          }
        });
        // Vérifier si les joueurs attendus sont déjà présents
        this.checkExpectedPlayers();
      }
    });

    this.gameSocket.on('addPlayer', (player) => {      
      const nick = player.profile?.nickname || `Player${player.profile?.peerId}`;
      const auth = player.profile?.auth;
      
      console.log(`👤 Joueur: ${nick}`, auth ? `(${auth.service}: ${auth.username || auth.id})` : '');
      
      // === DEBUG: Log détaillé pour JKLM staff (service=jklm) ===
      if (auth?.service === 'jklm') {
        console.log(`🔍 [DEBUG-JKLM-STAFF] Compte JKLM détecté dans la partie:`);
        console.log(`   - nickname (affiché): "${nick}"`);
        console.log(`   - auth.username (permanent): "${auth.username || 'N/A'}"`);
        console.log(`   - auth.id: "${auth.id || 'N/A'}"`);
        console.log(`   - auth complet:`, JSON.stringify(auth));
        console.log(`   - Tentative de matching avec expectedPlayers...`);
        
        // Debug du matching pour JKLM staff
        this.expectedPlayers.forEach(exp => {
          if (exp.service === 'jklm') {
            console.log(`     - Attendu: service=${exp.service}, id="${exp.id}", username="${exp.username}"`);
            const matchById = auth.id && exp.id && String(auth.id) === String(exp.id);
            const matchByUsername = exp.username && auth.username && auth.username.toLowerCase() === exp.username.toLowerCase();
            const matchByNick = exp.username && nick && nick.toLowerCase() === exp.username.toLowerCase();
            console.log(`       -> Match par ID: ${matchById}, par username: ${matchByUsername}, par nick: ${matchByNick}`);
          }
        });
      }
      
      this.players.set(player.profile?.peerId, {
        nickname: nick,
        peerId: player.profile?.peerId,
        auth: auth,
        score: 0,
      });

      // Message chat selon si le joueur est attendu ou non
      if (this.expectedPlayers.length > 0) {
        const isExpected = this.findExpectedPlayer(nick, auth);
        const connectedCount = this.countConnectedExpectedPlayers();
        const totalExpected = this.expectedPlayers.length;
        
        // === CONNECTION LOG for Admin Panel ===
        if (isExpected) {
          // Determine how the match was made
          let matchMethod = 'unknown';
          if (auth?.service === 'discord') matchMethod = 'Discord auth';
          else if (auth?.service === 'twitch') matchMethod = 'Twitch auth';
          else if (auth?.service === 'jklm') matchMethod = `JKLM username "${auth.username}"`;
          else matchMethod = `Nickname "${nick}"`;
          
          console.log(`🔗 [CONNECTION] ✅ ${nick} | Room: ${this.roomCode} | Status: OK | Method: ${matchMethod} | Queue: ${connectedCount}/${totalExpected}`);
          
          // Joueur inscrit et attendu - afficher le compteur de progression
          const isEnglish = this.customRules?.dictionaryId === 'en';
          const joinedMsg = isEnglish
            ? `✅ ${nick} joined the game! (${connectedCount}/${totalExpected})`
            : `✅ ${nick} a rejoint la partie ! (${connectedCount}/${totalExpected})`;
          this.sendChat(joinedMsg);
          
          // POST to connection-logs API (async, don't await)
          this.sendConnectionLog({
            roomCode: this.roomCode,
            nickname: nick,
            success: true,
            method: matchMethod,
            authService: auth?.service || null,
            authId: auth?.id || null,
            category: this.category,
            queueCount: `${connectedCount}/${totalExpected}`
          });
        } else {
          // Determine why the match failed
          let failReason = 'Unknown';
          if (!auth) {
            failReason = 'Guest account (no auth)';
          } else if (auth.service === 'jklm') {
            const expectedJklm = this.expectedPlayers.filter(e => e.service === 'jklm');
            if (expectedJklm.length === 0) {
              failReason = 'No JKLM accounts expected in queue';
            } else {
              failReason = `JKLM "${auth.username || nick}" not in queue`;
            }
          } else if (auth.service === 'discord') {
            failReason = `Discord ID ${auth.id} not in queue`;
          } else if (auth.service === 'twitch') {
            failReason = `Twitch ID ${auth.id} not in queue`;
          } else {
            failReason = `${auth.service} account not matched`;
          }
          
          console.log(`🔗 [CONNECTION] ❌ ${nick} | Room: ${this.roomCode} | Status: FAILED | Reason: ${failReason}`);
          console.log(`⚠️ [QUEUE] Joueur NON ATTENDU dans la partie: "${nick}"`);
          console.log(`   - peerId: ${player.profile?.peerId}`);
          console.log(`   - auth: ${auth ? JSON.stringify(auth) : 'null (guest)'}`); 
          console.log(`   - ⚠️ Ce joueur recevra du MMR à la fin du match sans avoir queue!`);
          
          // POST to connection-logs API (async, don't await)
          this.sendConnectionLog({
            roomCode: this.roomCode,
            nickname: nick,
            success: false,
            failReason: failReason,
            authService: auth?.service || null,
            authId: auth?.id || null,
            category: this.category,
            queueCount: `${connectedCount}/${totalExpected}`
          });
        }
        // Note: le message de bienvenue pour les non-inscrits est envoyé dans chatterAdded (lobby join)
      } else {
        // No expected players - test mode or open game
        console.log(`🔗 [CONNECTION] ℹ️ ${nick} | Room: ${this.roomCode} | Status: OK (no queue)`);
      }

      // Vérifier si tous les joueurs attendus ont rejoint
      this.checkExpectedPlayers();
    });

    this.gameSocket.on('startChallenge', (challenge) => {
      console.log('❓ Question:', challenge.prompt?.substring(0, 50));
      this.roundCounter++;
      
      // Generate question hash for identification
      const questionHash = this.generateQuestionHash(challenge);
      console.log(`🔑 Question hash: ${questionHash}`);
      
      this.currentChallenge = {
        question: challenge.prompt,
        text: challenge.text || null,
        imageHash: challenge.image?.data ? this.hashBuffer(challenge.image.data) : null,
        questionHash: questionHash,
        index: this.roundCounter,
        playerTimes: new Map(), // peerId -> elapsedTime
        rawChallenge: challenge  // Store for learning
      };
      
      // [SOLO MODE] Don't answer immediately - wait for user to answer first
      // The bot will answer after the user in setPlayerState handler
    });

    this.gameSocket.on('setPlayerState', (peerId, state) => {
      const player = this.players.get(peerId);
      if (player && state.points !== undefined) {
        player.score = state.points;
      }
      
      // Tracking du temps de réponse si trouvé
      if (this.currentChallenge && state.hasFoundSource && state.elapsedTime > 0) {
        if (!this.currentChallenge.playerTimes.has(peerId)) {
           // On enregistre le premier temps valide reçu pour ce joueur sur ce round
           this.currentChallenge.playerTimes.set(peerId, state.elapsedTime);
        }
        
        // [SOLO MODE] When a NON-BOT player finds the answer, bot answers immediately after
        if (this.soloMode && peerId !== this.selfPeerId && this.currentChallenge.questionHash) {
          // Prevent bot from answering multiple times for same question
          if (!this.currentChallenge.botAnswered) {
            this.currentChallenge.botAnswered = true;
            console.log(`✅ [SOLO] Utilisateur a trouvé ! Bot va répondre...`);
            this.tryAnswer(this.currentChallenge.questionHash);
          }
        }
      }
    });

    this.gameSocket.on('endChallenge', (result) => {
      // result format: { source: "...", submitter: "...", details: "...", fastest: "PlayerName", ... }
      console.log('🏁 Fin du round!');
      
      // Enregistrer les réponses de ce round
      if (this.currentChallenge) {
        const { question, text, imageHash, questionHash, index, playerTimes, rawChallenge } = this.currentChallenge;
        const correctAnswer = result.source;
        const playerAnswers = result.foundSourcesByPlayerPeerId || {};
        
        // [SOLO MODE] Learn the correct answer for this question
        if (this.soloMode && rawChallenge && correctAnswer) {
          this.learnQuestion(rawChallenge, correctAnswer);
        }
        
        for (const [peerId, elapsedTime] of playerTimes.entries()) {
            const player = this.players.get(peerId);
            if (player) {
                const actualAnswer = playerAnswers[peerId] || correctAnswer; // Si pas trouvé spécifiquement, on suppose qu'ils ont trouvé la bonne réponse (cas rare sans foundSourcesByPlayerPeerId)
                
                this.matchAnswers.push({
                    peerId: peerId,
                    nickname: player.nickname,
                    roundIndex: index,
                    question: question,
                    questionText: text,         // Le texte de la question (si pas image)
                    questionImageHash: imageHash, // Hash de l'image (si question image)
                    questionHash: questionHash, // Hash unique pour identifier la question
                    answer: correctAnswer,      // La bonne réponse attendue
                    playerAnswer: actualAnswer, // Ce que le joueur a écrit
                    elapsedTime: elapsedTime
                });
            }
        }
        this.currentChallenge = null;
      }
      
      let message = '';
      if (result.fastest) {
          message = `🏆 Gg ${result.fastest} !`;
          console.log(`🏆 BRAVO ${result.fastest} ! (Vainqueur du round)`);
      } else {
          message = '🤷 Personne n\'a trouvé...';
          console.log('🤷 Personne n\'a trouvé la réponse.');
      }
      
      // Annoncer dans le chat : DÉSACTIVÉ pour les rounds
      // this.sendChat(message);

      console.log(`✅ Réponse: ${result.source}`);
      if (result.details) {
          console.log(`ℹ️ Détails: ${result.details}`);
      }
      
      // [SOLO MODE] Track user's streak
      if (this.soloMode) {
        // Debug: log what we receive
        console.log(`🔍 [SOLO DEBUG] result.fastest: ${result.fastest}`);
        console.log(`🔍 [SOLO DEBUG] result.foundSourcesByPlayerPeerId:`, result.foundSourcesByPlayerPeerId);
        console.log(`🔍 [SOLO DEBUG] selfPeerId: ${this.selfPeerId}, players:`, [...this.players.keys()]);
        
        // Check if the human player (non-bot) found the answer
        // Method 1: Check foundSourcesByPlayerPeerId
        const userPeerIds = [...this.players.keys()].filter(id => id !== this.selfPeerId);
        let userFoundAnswer = userPeerIds.some(peerId => 
          result.foundSourcesByPlayerPeerId && result.foundSourcesByPlayerPeerId[peerId]
        );
        
        // Method 2: If no foundSourcesByPlayerPeerId, check if fastest is a non-bot player
        if (!userFoundAnswer && result.fastest) {
          const fastestPlayer = [...this.players.values()].find(p => p.nickname === result.fastest);
          if (fastestPlayer && fastestPlayer.peerId !== this.selfPeerId) {
            userFoundAnswer = true;
          }
        }
        
        if (userFoundAnswer) {
          this.soloStreak++;
          if (this.soloStreak > this.soloBestStreak) {
            this.soloBestStreak = this.soloStreak;
          }
          console.log(`🔥 [SOLO] Streak: ${this.soloStreak} (Best: ${this.soloBestStreak})`);
          // Persist streak to database
          this.updateStreakInDb();
          
          // Record the user's answer for speed leaderboard
          // Find the user's peerId and their response time
          let userPeerId = userPeerIds.find(peerId => 
            result.foundSourcesByPlayerPeerId && result.foundSourcesByPlayerPeerId[peerId]
          );
          
          // Fallback: if foundSourcesByPlayerPeerId is empty, find by fastest nickname
          if (!userPeerId && result.fastest) {
            const fastestPlayer = [...this.players.values()].find(p => p.nickname === result.fastest);
            if (fastestPlayer && fastestPlayer.peerId !== this.selfPeerId) {
              userPeerId = fastestPlayer.peerId;
            }
          }
          
          if (userPeerId && this.currentChallenge) {
            const userTime = this.currentChallenge.playerTimes.get(userPeerId);
            const playerAnswer = result.foundSourcesByPlayerPeerId?.[userPeerId] || result.source;
            
            // Use result.fastest time if playerTimes doesn't have it
            const elapsedTime = userTime || (result.elapsedTime ? result.elapsedTime : null);
            
            if (elapsedTime) {
              this.recordSoloAnswer({
                question: this.currentChallenge.rawChallenge?.prompt,
                questionHash: this.currentChallenge.questionHash,
                answer: result.source,
                playerAnswer: playerAnswer,
                elapsedTime: elapsedTime,
                roundIndex: this.currentChallenge.roundIndex || 0,
                peerId: userPeerId
              });
            } else {
              console.log(`⚠️ [SOLO] No elapsed time found for userPeerId ${userPeerId}`);
            }
          } else {
            console.log(`⚠️ [SOLO] Could not find user peerId for recording answer`);
          }
        } else {
          if (this.soloStreak > 0) {
            console.log(`💔 [SOLO] Streak perdu ! (était: ${this.soloStreak})`);
            // Send chat message about lost streak
            this.sendChat(`💔 Streak perdue ! (${this.soloStreak} consécutives)`);
          }
          this.soloStreak = 0;
          // Persist reset streak to database
          this.updateStreakInDb();
        }
      }
    });

    this.gameSocket.on('setMilestone', (milestone) => {
      if (milestone.lastRound?.winner) {
        console.log(`🏆 GAGNANT: ${milestone.lastRound.winner.nickname}`);
        const isEnglish = this.customRules?.dictionaryId === 'en';
        const victoryMsg = isEnglish
          ? `👑 ${milestone.lastRound.winner.nickname} WINS!`
          : `👑 VICTOIRE DE ${milestone.lastRound.winner.nickname} !`;
        this.sendChat(victoryMsg);
        this.compileResults();
      }
    });

    this.gameSocket.onAny((event, ...args) => {
      if (!['setPlayerState'].includes(event)) {
        console.log(`📥 [GAME] ${event}:`, JSON.stringify(args).substring(0, 100));
      }
    });
  }

  sendChat(message) {
    if (this.roomSocket && this.roomSocket.connected) {
        console.log(`💬 Envoi chat: "${message}"`);
        this.roomSocket.emit('chat', message);
    } else {
        console.warn('⚠️ Impossible d\'envoyer le chat (roomSocket déconnecté)');
    }
  }

  compileResults() {
    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score);
    console.log('\n📊 RÉSULTATS:');
    
    // Afficher les scores dans le chat
    const isEnglish = this.customRules?.dictionaryId === 'en';
    this.sendChat(isEnglish ? '🏆 FINAL RESULTS:' : '🏆 RÉSULTATS FINAUX:');
    
    sorted.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.nickname}: ${p.score} pts`, p.auth ? `(${p.auth.service}:${p.auth.id})` : '');
      
      // Trouver si ce joueur était attendu pour récupérer ses infos
      const expectedInfo = this.findExpectedPlayer(p.nickname, p.auth);
      
      // === DEBUG: Signaler les joueurs non-attendus dans les résultats finaux ===
      if (this.expectedPlayers.length > 0 && !expectedInfo) {
        console.log(`⚠️ [RESULT] Joueur NON ATTENDU dans les résultats finaux: "${p.nickname}"`);
        console.log(`   - Placement: ${i + 1}, Score: ${p.score} pts`);
        console.log(`   - auth: ${p.auth ? JSON.stringify(p.auth) : 'null (guest)'}`);
        console.log(`   - ⚠️ Ce joueur va potentiellement recevoir du MMR via le callback!`);
      }
      
      this.gameResults.push({ 
        placement: i + 1, 
        nickname: p.nickname, 
        score: p.score,
        auth: p.auth || null, // Info Discord/Twitch si disponible
        expectedPlayer: expectedInfo || null // Infos joueur attendu si matché
      });
      
      // Message chat pour chaque joueur
      this.sendChat(`${i + 1}. ${p.nickname}: ${p.score} pts`);
    });
    
    if (this.callbackUrl) {
        const callbackBody = { 
            roomCode: this.roomCode,
            scores: this.gameResults,
            answers: this.matchAnswers,
            category: this.category,
            startedAt: this.startedAt  // Timestamp de début passé par le serveur
        };
        console.log(`📤 [CALLBACK] Envoi des résultats au callback: ${this.callbackUrl}`);
        console.log(`📤 [CALLBACK] Body:`, JSON.stringify(callbackBody, null, 2));
        
        fetch(this.callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(callbackBody)
        }).then(async res => {
            const responseText = await res.text();
            console.log(`✅ [CALLBACK] Statut: ${res.status}`);
            console.log(`✅ [CALLBACK] Réponse:`, responseText.substring(0, 500));
            this.disconnect();
            process.exit(0);
        }).catch(err => {
            console.error('❌ [CALLBACK] Erreur:', err.message);
            console.error('❌ [CALLBACK] Stack:', err.stack);
            this.disconnect();
            process.exit(1);
        });
    } else {
        console.log('⚠️ Pas de callback URL configurée.');
        this.disconnect();
        process.exit(0);
    }

    return this.gameResults;
  }

  /**
   * Send connection log to API for admin monitoring
   * Called async (fire and forget) when players join
   */
  sendConnectionLog(data) {
    if (!this.callbackUrl) return; // No callback URL = no logging
    
    // Derive base URL from callback URL
    const baseUrl = this.callbackUrl.replace(/\/api\/match\/callback$/, '');
    const logUrl = `${baseUrl}/api/admin/connection-logs`;
    
    fetch(logUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => {
      console.error('❌ [CONNECTION-LOG] Failed to send:', err.message);
    });
  }

  /**
   * Generate SHA256 hash of a buffer (for images)
   */
  hashBuffer(buffer) {
    if (!buffer) return null;
    // Handle both Buffer and ArrayBuffer
    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 32);
  }

  /**
   * Generate a unique hash for a question based on its content
   * Format: SHA256(prompt + "|" + content)
   * Where content is either the text or "img:" + imageHash
   */
  generateQuestionHash(challenge) {
    const prompt = challenge.prompt || '';
    let content = '';
    
    if (challenge.text) {
      // Text question: use the text content
      content = challenge.text;
    } else if (challenge.image?.data) {
      // Image question: use hash of the image
      const imgHash = this.hashBuffer(challenge.image.data);
      content = 'img:' + imgHash;
    }
    
    const combined = prompt + '|' + content;
    return crypto.createHash('sha256').update(combined).digest('hex').slice(0, 32);
  }

  /**
   * [SOLO MODE] Look up answer for a question via API
   */
  async lookupAnswer(questionHash) {
    if (!this.callbackUrl) return null;
    
    try {
      const res = await fetch(`${this.callbackUrl}/api/popsauce/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionHash })
      });
      
      if (!res.ok) return null;
      
      const data = await res.json();
      if (data.found && data.answer) {
        console.log(`📖 [SOLO] Réponse trouvée en DB: ${data.answer}`);
        return data.answer;
      }
    } catch (err) {
      console.log(`⚠️ [SOLO] Lookup failed: ${err.message}`);
    }
    
    return null;
  }

  /**
   * [SOLO MODE] Learn a new answer from game result
   */
  async learnQuestion(challenge, correctAnswer) {
    if (!this.callbackUrl || !correctAnswer) return;
    
    const questionHash = this.generateQuestionHash(challenge);
    
    try {
      const payload = {
        questionHash,
        prompt: challenge.prompt,
        text: challenge.text || null,
        imageHash: challenge.image?.data ? this.hashBuffer(challenge.image.data) : null,
        correctAnswer
      };
      
      const res = await fetch(`${this.callbackUrl}/api/popsauce/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        console.log(`📚 [SOLO] Question apprise: ${correctAnswer}`);
      }
    } catch (err) {
      console.log(`⚠️ [SOLO] Learn failed: ${err.message}`);
    }
  }

  /**
   * [SOLO MODE] Try to answer a question if we know it
   */
  async tryAnswer(questionHash) {
    if (!this.soloMode) return;
    
    const answer = await this.lookupAnswer(questionHash);
    if (answer && this.gameSocket?.connected) {
      setTimeout(() => {
        if (this.gameSocket?.connected) {
          this.gameSocket.emit('submitGuess', answer);
          console.log(`🤖 [SOLO] Bot répond: ${answer}`);
        }
      }, 1);
      //submit answer after 1ms delay
    }
  }

  /**
   * [SOLO MODE] Update streak in database
   */
  async updateStreakInDb() {
    if (!this.soloMode || !this.sessionId) return;
    
    try {
      const res = await fetch(`${this.callbackUrl}/api/solo/update-streak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          streak: this.soloStreak,
          bestStreak: this.soloBestStreak
        })
      });
      
      if (res.ok) {
        console.log(`📊 [SOLO] Streak saved to DB: ${this.soloStreak} (Best: ${this.soloBestStreak})`);
      } else {
        console.log(`⚠️ [SOLO] Failed to save streak: ${res.status}`);
      }
    } catch (err) {
      console.log(`⚠️ [SOLO] Error saving streak: ${err.message}`);
    }
  }

  /**
   * [SOLO MODE] Record a solo answer for speed leaderboard
   */
  async recordSoloAnswer(data) {
    if (!this.soloMode || !this.userId) return;
    
    try {
      const res = await fetch(`${this.callbackUrl}/api/solo/record-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          userId: this.userId,
          questionHash: data.questionHash,
          question: data.question,
          answer: data.answer,
          playerAnswer: data.playerAnswer,
          elapsedTime: data.elapsedTime,
          peerId: data.peerId,
          roundIndex: data.roundIndex
        })
      });
      
      if (res.ok) {
        console.log(`📊 [SOLO] Answer recorded: ${data.playerAnswer} in ${data.elapsedTime}ms`);
      } else {
        console.log(`⚠️ [SOLO] Failed to record answer: ${res.status}`);
      }
    } catch (err) {
      console.log(`⚠️ [SOLO] Error recording answer: ${err.message}`);
    }
  }

  disconnect() {
    this.roomSocket?.disconnect();
    this.gameSocket?.disconnect();
  }

  cancelMatch(reason) {
    console.log(`❌ Annulation du match: ${reason}`);
    
    // Annuler tous les timers
    if (this.lobbyTimeout) {
      clearTimeout(this.lobbyTimeout);
      this.lobbyTimeout = null;
    }
    if (this.warningTimeout30) {
      clearTimeout(this.warningTimeout30);
      this.warningTimeout30 = null;
    }
    if (this.warningTimeout50) {
      clearTimeout(this.warningTimeout50);
      this.warningTimeout50 = null;
    }
    
    // Envoyer le callback d'annulation
    if (this.callbackUrl) {
      const cancelBody = {
        roomCode: this.roomCode,
        cancelled: true,
        reason: reason,
        category: this.category
      };
      console.log(`📤 [CANCEL] Envoi du callback d'annulation: ${this.callbackUrl}`);
      console.log(`📤 [CANCEL] Body:`, JSON.stringify(cancelBody, null, 2));
      
      fetch(this.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cancelBody)
      }).then(async res => {
        const responseText = await res.text();
        console.log(`✅ [CANCEL] Callback statut: ${res.status}`);
        console.log(`✅ [CANCEL] Réponse:`, responseText.substring(0, 500));
        this.disconnect();
        process.exit(0);
      }).catch(err => {
        console.error('❌ [CANCEL] Erreur callback:', err.message);
        console.error('❌ [CANCEL] Stack:', err.stack);
        this.disconnect();
        process.exit(1);
      });
    } else {
      console.log('⚠️ Pas de callback URL configurée.');
      this.disconnect();
      process.exit(0);
    }
  }

  setExpectedPlayers(players) {
    // players = [{ service: 'discord', id: '...' }, { service: 'jklm', username: '...' }]
    this.expectedPlayers = players.map(p => ({
      service: p.service.toLowerCase(),
      id: p.id || null,
      username: p.username ? p.username.toLowerCase().trim() : null
    }));
    console.log(`⏳ En attente de ${this.expectedPlayers.length} joueurs:`);
    this.expectedPlayers.forEach(p => console.log(`  - ${p.service}:${p.id || p.username}`));
  }

  applyRules() {
    console.log('⚙️ Application des règles PSL...');
    if (!this.gameSocket?.connected) {
      console.log('❌ gameSocket non connecté, abandon applyRules');
      return;
    }
    
    const rules = this.customRules || { scoreGoal: 150, challengeDuration: 12, dictionaryId: 'fr' };
    console.log('📋 Règles à appliquer:', JSON.stringify(rules));
    
    // IMPORTANT: dictionaryId EN PREMIER car changer de langue reset les autres paramètres !
    this.gameSocket.emit('setRules', { dictionaryId: rules.dictionaryId || 'fr' });
    console.log('  ✓ dictionaryId:', rules.dictionaryId || 'fr');
    
    // Délai pour laisser le serveur processer le changement de langue
    setTimeout(() => {
      if (!this.gameSocket?.connected) return;
      
      // Score goal
      this.gameSocket.emit('setRules', { scoreGoal: rules.scoreGoal || 150 });
      console.log('  ✓ scoreGoal:', rules.scoreGoal || 150);
      
      // Challenge duration (avec délai)
      setTimeout(() => {
        if (!this.gameSocket?.connected) return;
        
        this.gameSocket.emit('setRules', { challengeDuration: rules.challengeDuration || 12 });
        console.log('  ✓ challengeDuration:', rules.challengeDuration || 12);
        
        // TagOps pour filtrer le dictionnaire (après les autres règles)
        // Note: tableau vide = clear tous les filtres, undefined = ne rien changer
        if (rules.tagOps && Array.isArray(rules.tagOps)) {
          setTimeout(() => {
            if (!this.gameSocket?.connected) return;
            console.log('  📁 setTagOps:', JSON.stringify(rules.tagOps));
            this.gameSocket.emit('setTagOps', rules.tagOps);
            console.log(rules.tagOps.length > 0 ? '  ✓ tagOps appliqués' : '  ✓ filtres effacés (tableau vide)');
          }, 200);
        }
      }, 200);
    }, 300);
  }

  /**
   * Apply solo-specific rules:
   * - Scoring: constant (10 points per answer)
   * - Challenge duration based on mode (HARDCORE=5s, CHALLENGE=8s, NORMAL=12s)
   * - High score goal to prevent early game end
   */
  applySoloRules() {
    console.log('🎯 [SOLO] Application des règles solo...');
    if (!this.gameSocket?.connected) {
      console.log('❌ [SOLO] gameSocket non connecté, abandon applySoloRules');
      return;
    }
    
    // Determine challenge duration based on mode
    const modeDurations = {
      'HARDCORE': 5,
      'CHALLENGE': 8,
      'NORMAL': 12
    };
    const duration = modeDurations[this.soloModeType] || 12;
    
    console.log(`📋 [SOLO] Mode: ${this.soloModeType || 'NORMAL'}, Duration: ${duration}s`);
    
    // IMPORTANT: dictionaryId EN PREMIER car changer de langue reset les autres paramètres !
    // (like ranked bot applyRules)
    this.gameSocket.emit('setRules', { dictionaryId: 'fr' });
    console.log('  ✓ dictionaryId: fr');
    
    // Delay before setting other rules
    setTimeout(() => {
      if (!this.gameSocket?.connected) return;
      
      // 1. Set scoring to constant (10 points per answer regardless of speed)
      this.gameSocket.emit('setRules', { scoring: 'constant' });
      console.log('  ✓ scoring: constant');
      
      // 2. Set challenge duration
      setTimeout(() => {
        if (!this.gameSocket?.connected) return;
        this.gameSocket.emit('setRules', { challengeDuration: duration });
        console.log(`  ✓ challengeDuration: ${duration}`);
        
        // 3. Set high score goal (max 1000 per JKLM limits)
        setTimeout(() => {
          if (!this.gameSocket?.connected) return;
          this.gameSocket.emit('setRules', { scoreGoal: 1000 });
          console.log('  ✓ scoreGoal: 1000');
          
          // 4. Lock rules and wait for player
          setTimeout(() => {
            if (!this.gameSocket?.connected) return;
            this.gameSocket.emit('setRulesLocked', true);
            console.log('🔒 [SOLO] Règles verrouillées, en attente du joueur...');
          }, 300);
        }, 300);
      }, 300);
    }, 400);
  }

  /**
   * Apply solo-specific rules synchronously (for use right before starting game)
   * This version doesn't lock rules - the game will start immediately after
   */
  applySoloRulesSync() {
    console.log('🎯 [SOLO] Application des règles solo (sync)...');
    if (!this.gameSocket?.connected) {
      console.log('❌ [SOLO] gameSocket non connecté');
      return;
    }
    
    // Category configs (matching game-modes.ts)
    const CATEGORY_CONFIG = {
      'GP_FR': { dictionaryId: 'fr', tagOps: [{ op: 'union', tag: 'Grand public' }, { op: 'difference', tag: 'Difficile' }] },
      'MS_EN': { dictionaryId: 'en', tagOps: [{ op: 'union', tag: 'Mainstream' }, { op: 'difference', tag: 'Hard' }] },
      'ANIME': { dictionaryId: 'en', tagOps: [{ op: 'intersection', tag: 'Anime & Manga' }] },
      'FLAGS': { dictionaryId: 'en', tagOps: [{ op: 'intersection', tag: 'Flags' }] },
      'NOFILTER_FR': { dictionaryId: 'fr', tagOps: [] },
      'NOFILTER_EN': { dictionaryId: 'en', tagOps: [] }
    };
    
    const config = CATEGORY_CONFIG[this.category] || CATEGORY_CONFIG['GP_FR'];
    
    const modeDurations = {
      'HARDCORE': 5,
      'CHALLENGE': 8,
      'NORMAL': 12
    };
    const duration = modeDurations[this.soloModeType] || 12;
    
    console.log(`📋 [SOLO] Mode: ${this.soloModeType || 'NORMAL'}, Duration: ${duration}s, Category: ${this.category}`);
    
    // STEP 1: Unlock rules panel (required to change rules)
    this.gameSocket.emit('setRulesLocked', false);
    console.log('  🔓 Panel règles ouvert');
    
    // STEP 2: Set dictionaryId FIRST (changing language resets other params)
    this.gameSocket.emit('setRules', { dictionaryId: config.dictionaryId });
    console.log(`  ✓ dictionaryId: ${config.dictionaryId}`);
    
    // STEP 3: Apply scoring and timing rules
    this.gameSocket.emit('setRules', { scoring: 'constant' });
    console.log('  ✓ scoring: constant');
    
    this.gameSocket.emit('setRules', { challengeDuration: duration });
    console.log(`  ✓ challengeDuration: ${duration}`);
    
    this.gameSocket.emit('setRules', { scoreGoal: 1000 });
    console.log('  ✓ scoreGoal: 1000');
    
    // STEP 4: Apply tag filters for category
    if (config.tagOps) {
      this.gameSocket.emit('setTagOps', config.tagOps);
      console.log(`  ✓ tagOps: ${JSON.stringify(config.tagOps)}`);
    }
    
    // STEP 5: Lock rules panel (allows game to start normally)
    this.gameSocket.emit('setRulesLocked', true);
    console.log('  🔒 Panel règles fermé');
  }

  findExpectedPlayer(nickname, auth) {
    // Cherche si ce joueur était attendu (pour récupérer son userId)
    if (!auth && !nickname) return null;
    
    for (const exp of this.expectedPlayers) {
      // Match par auth (Discord/Twitch ID) - normalisation des IDs en string
      if (auth?.service?.toLowerCase() === exp.service && auth?.id && exp.id) {
        if (String(auth.id) === String(exp.id)) {
          return exp;
        }
      }
      
      // Pour JKLM staff: match par auth.username (username permanent JKLM)
      if (exp.service === 'jklm' && auth?.service === 'jklm' && exp.username && auth?.username) {
        if (auth.username.toLowerCase() === exp.username.toLowerCase()) {
          return exp;
        }
      }
      
      // Match par nickname si pas d'ID (fallback pour JKLM et guests)
      if (exp.username && nickname?.toLowerCase() === exp.username.toLowerCase()) {
        return exp;
      }
    }
    return null;
  }

  countConnectedExpectedPlayers() {
    // Compte combien de joueurs attendus sont déjà connectés
    let count = 0;
    for (const player of this.players.values()) {
      if (this.findExpectedPlayer(player.nickname, player.auth)) {
        count++;
      }
    }
    return count;
  }

  checkExpectedPlayers() {
    if (this.expectedPlayers.length === 0 || this.allPlayersJoined) return;

    // Utiliser findExpectedPlayer pour une logique de matching cohérente
    // avec countConnectedExpectedPlayers
    const joinedPlayers = [...this.players.values()];
    
    console.log(`🔍 [CHECK] Joueurs présents dans la partie:`);
    joinedPlayers.forEach(p => console.log(`  - ${p.nickname} (auth: ${p.auth ? p.auth.service + ':' + p.auth.id : 'none'})`));

    // Trouver les joueurs attendus qui ne sont pas encore matchés
    const missing = this.expectedPlayers.filter(exp => {
      // Chercher parmi les joueurs présents un qui match cet expected player
      const found = joinedPlayers.some(jp => {
        const matched = this.findExpectedPlayer(jp.nickname, jp.auth);
        // Si ce joueur match, vérifier que c'est LE MEME expected player
        if (!matched) return false;
        return matched.id === exp.id && matched.service === exp.service;
      });
      return !found;
    });

    const connectedCount = this.expectedPlayers.length - missing.length;
    console.log(`🔍 [CHECK] Attendus: ${this.expectedPlayers.length}, matchés: ${connectedCount}, manquants: ${missing.length}`);
    if (missing.length > 0) {
      console.log(`⏳ [CHECK] Manquants:`);
      missing.forEach(p => console.log(`  - Service: ${p.service}, ID: ${p.id}, Username: "${p.username}"`));
    }

    if (missing.length === 0) {
      this.allPlayersJoined = true;
      console.log('✅ Tous les joueurs attendus ont rejoint!');
      
      // Annuler tous les timeouts
      if (this.lobbyTimeout) {
        clearTimeout(this.lobbyTimeout);
        this.lobbyTimeout = null;
      }
      if (this.warningTimeout30) {
        clearTimeout(this.warningTimeout30);
        this.warningTimeout30 = null;
      }
      if (this.warningTimeout50) {
        clearTimeout(this.warningTimeout50);
        this.warningTimeout50 = null;
      }
      
      // Déverrouiller les règles (mais ne plus forcer startRoundNow - laisser le countdown naturel)
      setTimeout(() => {
        if (this.gameSocket?.connected) {
          console.log(`🎮 [START] Tous les joueurs attendus sont présents!`);
          
          if (this.isLeader) {
            // Déverrouiller les règles pour permettre le jeu
            console.log('🔓 [START] Déverrouillage des règles (isLeader=true)...');
            this.gameSocket.emit('setRulesLocked', true); // true = menu fermé = permet le jeu
            
            // NE PLUS forcer startRoundNow - laisser le countdown naturel de 15s
            console.log('⏳ [START] Attente du countdown naturel JKLM (15s)...');
            // this.gameSocket.emit('startRoundNow'); // DISABLED - let countdown finish
          } else {
            console.log('ℹ️ [START] Le bot n\'est pas leader, attente du countdown naturel...');
          }
        } else {
          console.error('❌ [START] gameSocket déconnecté!');
        }
      }, 2000);
    }
  }

  // Mode vérification: écoute les messages chat
  setVerifyMode(code, callbackUrl) {
    this.verifyMode = true;
    this.verifyCode = code;
    this.callbackUrl = callbackUrl;
    console.log(`🔐 Mode vérification: en attente du code ${code}`);
  }

  handleChatMessage(sender, message) {
    if (!this.verifyMode || !this.verifyCode) return;

    // Vérifier si le message contient le code attendu
    if (message.includes(this.verifyCode)) {
      // Extraire les infos du sender
      const nickname = (typeof sender === 'object' && sender) ? sender.nickname : sender;
      const auth = (typeof sender === 'object' && sender) ? sender.auth : null;
      
      // Pour les comptes JKLM staff, auth.username est le username permanent ("Hyceman on JKLM.FUN")
      // Alors que nickname est juste le pseudo d'affichage (peut changer)
      const permanentUsername = auth?.service === 'jklm' && auth?.username ? auth.username : null;
      
      console.log(`✅ Code ${this.verifyCode} trouvé de ${nickname}!`);
      console.log(`   auth: ${JSON.stringify(auth)}`);
      console.log(`   username permanent: ${permanentUsername || 'N/A'}`);
      
      this.sendVerificationCallback(nickname, permanentUsername);
    }
  }

  async sendVerificationCallback(nickname, permanentUsername) {
    if (!this.callbackUrl) return;

    try {
      const response = await fetch(this.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: this.verifyCode,
          nickname,
          permanentUsername, // Nouveau champ: username permanent pour JKLM staff
          roomCode: this.roomCode
        })
      });

      if (response.ok) {
        console.log(`✅ Vérification réussie pour ${nickname} (permanent: ${permanentUsername || 'N/A'})!`);
        // Envoyer un message de confirmation
        this.roomSocket?.emit('chat', `✅ ${nickname}, ton compte JKLM est maintenant lié à PSL !`);
        // Attendre un peu puis quitter
        setTimeout(() => {
          this.disconnect();
          process.exit(0);
        }, 3000);
      } else {
        const data = await response.json();
        console.log(`❌ Vérification échouée: ${data.error}`);
        if (data.error === 'Nickname mismatch') {
          this.roomSocket?.emit('chat', `❌ ${nickname}, ce code est pour un autre pseudo JKLM (${data.expected})`);
        }
      }
    } catch (err) {
      console.error('❌ Erreur callback vérification:', err);
    }
  }
}

async function main() {
  const bot = new JKLMBot();
  const args = process.argv.slice(2);
  
  let roomCode;
  let callbackUrl;
  let shouldCreate = false;
  let expectedPlayers = [];
  let verifyMode = false;
  let verifyCode = null;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--create') {
      shouldCreate = true;
    } else if (args[i] === '--players') {
      // Ancien format: --players "nick1,nick2" (rétrocompatibilité)
      if (args[i + 1]) {
        expectedPlayers = args[i + 1].split(',').map(n => ({
          service: 'jklm',
          username: n.trim()
        }));
        i++;
      }
    } else if (args[i] === '--players-json') {
      // Nouveau format: --players-json '[{"service":"discord","username":"jd85"},...]'
      if (args[i + 1]) {
        try {
          expectedPlayers = JSON.parse(args[i + 1]);
          console.log('📋 Joueurs attendus (JSON):', expectedPlayers);
        } catch (e) {
          console.error('❌ Erreur parsing --players-json:', e);
        }
        i++;
      }
    } else if (args[i] === '--verify-mode') {
      verifyMode = true;
      if (args[i + 1] && !args[i + 1].startsWith('-') && !args[i + 1].startsWith('http')) {
        verifyCode = args[i + 1];
        i++;
      }
    } else if (args[i] === '--rules') {
      if (args[i + 1]) {
        try {
          bot.customRules = JSON.parse(args[i + 1]);
          console.log('📋 Règles personnalisées:', bot.customRules);
        } catch (e) {
          console.error('❌ Erreur parsing --rules:', e);
        }
        i++;
      }
    } else if (args[i] === '--category') {
      if (args[i + 1]) {
        bot.category = args[i + 1];
        console.log('📂 Catégorie:', bot.category);
        i++;
      }
    } else if (args[i] === '--started-at') {
      if (args[i + 1]) {
        bot.startedAt = args[i + 1];
        console.log('⏱️ StartedAt:', bot.startedAt);
        i++;
      }
    } else if (args[i] === '--test-mode') {
      bot.testMode = true;
      console.log('🧪 Test mode enabled (no MMR callback, log streaming on port 3099)');
    } else if (args[i] === '--solo-mode') {
      bot.soloMode = true;
      console.log('🎯 Solo mode enabled');
    } else if (args[i] === '--session') {
      if (args[i + 1]) {
        bot.sessionId = args[i + 1];
        console.log('📋 Session ID:', bot.sessionId);
        i++;
      }
    } else if (args[i] === '--user') {
      if (args[i + 1]) {
        bot.userId = args[i + 1];
        console.log('👤 User ID:', bot.userId);
        i++;
      }
    } else if (args[i] === '--mode') {
      if (args[i + 1]) {
        bot.soloModeType = args[i + 1];
        console.log('🎮 Solo mode type:', bot.soloModeType);
        i++;
      }
    } else if (args[i].startsWith('http')) {
      callbackUrl = args[i];
    } else if (args[i].length === 4 && !args[i].startsWith('-')) {
      roomCode = args[i];
    }
  }
  
  // Start HTTP server for log streaming in test mode
  if (bot.testMode) {
    const http = await import('http');
    const sseClients = [];
    
    // Patch console.log to capture all output for SSE streaming
    const originalLog = console.log.bind(console);
    const originalError = console.error.bind(console);
    
    const parseLevel = (msg) => {
      if (msg.includes('[CONNECTION]') || msg.includes('🔗')) return 'CONNECTION';
      if (msg.includes('[DEBUG]') || msg.includes('🔍')) return 'DEBUG';
      if (msg.includes('[PLAYER]') || msg.includes('👤') || msg.includes('addPlayer')) return 'PLAYER';
      if (msg.includes('[AUTH]') || msg.includes('🔐') || msg.includes('auth')) return 'AUTH';
      if (msg.includes('Error') || msg.includes('❌')) return 'ERROR';
      return 'INFO';
    };
    
    console.log = (...args) => {
      originalLog(...args);
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      bot.logBuffer.push({ ts: Date.now(), level: parseLevel(msg), msg });
    };
    
    console.error = (...args) => {
      originalError(...args);
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      bot.logBuffer.push({ ts: Date.now(), level: 'ERROR', msg });
    };
    
    bot.httpServer = http.createServer((req, res) => {
      if (req.url === '/logs') {
        // SSE endpoint
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        
        sseClients.push(res);
        console.log(`📡 SSE client connected (${sseClients.length} total)`);
        
        // Send initial message
        res.write(`data: ${JSON.stringify({ ts: Date.now(), level: 'INFO', msg: 'Connected to log stream' })}\n\n`);
        
        req.on('close', () => {
          const idx = sseClients.indexOf(res);
          if (idx > -1) sseClients.splice(idx, 1);
          console.log(`📡 SSE client disconnected (${sseClients.length} remaining)`);
        });
      } else if (req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          roomCode: bot.roomCode, 
          players: bot.players.size,
          testMode: true 
        }));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    
    bot.httpServer.listen(3099, () => {
      console.log('🌐 HTTP log server listening on port 3099');
    });
    
    // Broadcast logs to all SSE clients
    setInterval(() => {
      while (bot.logBuffer.length > 0) {
        const log = bot.logBuffer.shift();
        const data = `data: ${JSON.stringify(log)}\n\n`;
        sseClients.forEach(client => {
          try { client.write(data); } catch (e) {}
        });
      }
    }, 100);
  }
  
  try {
    // Mode création automatique
    if (shouldCreate) {
      let roomName = 'PSL Ranked';
      if (verifyMode) {
        roomName = 'PSL Verif';
      } else if (bot.testMode) {
        roomName = 'PSL Test Bot';
      } else {
        const categoryNames = {
          'GP_FR': 'GP [FR]',
          'MS_EN': 'MS [EN]',
          'ANIME': 'Anime',
          'FLAGS': 'Flags',
          'NOFILTER_FR': 'NF [FR]',
          'NOFILTER_EN': 'NF [EN]'
        };
        const catLabel = categoryNames[bot.category] || bot.category || 'GP';
        roomName = `PSL Bot - ${catLabel}`;
      }
      
      // Solo mode uses private room
      if (bot.soloMode) {
        roomName = 'PSL Solo Training';
      }
      
      console.log(`🏗️ Mode création automatique (${roomName})...`);
      const result = await bot.createRoom({ name: roomName, isPublic: !bot.testMode && !bot.soloMode });
      roomCode = result.roomCode;
      console.log(`🎮 Room créée: ${roomCode}`);
      
      // Solo mode: notify API immediately via callback
      if (bot.soloMode && callbackUrl && bot.sessionId) {
        console.log(`📤 [SOLO] Sending room_created callback...`);
        try {
          const callbackPayload = {
            type: 'room_created',
            sessionId: bot.sessionId,
            roomCode: roomCode,
            joinUrl: `https://jklm.fun/${roomCode}`
          };
          
          const res = await fetch(`${callbackUrl}/api/solo/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(callbackPayload)
          });
          console.log(`📥 [SOLO] Callback response: ${res.status}`);
        } catch (err) {
          console.error(`❌ [SOLO] Callback failed:`, err.message);
        }
      }
    }

    // Mode vérification
    if (verifyMode && verifyCode && callbackUrl) {
      bot.setVerifyMode(verifyCode, callbackUrl);
    }

    // Définir les joueurs attendus
    if (expectedPlayers.length > 0) {
      bot.setExpectedPlayers(expectedPlayers);
    }
    
    const nickname = verifyMode ? 'PSL-Verify' : 'PSL Bot';
    await bot.connect(roomCode, { nickname, callbackUrl });
    console.log('✅ Bot prêt!');
    
    // Auto-disconnect après 10 minutes en mode verify
    if (verifyMode) {
      setTimeout(() => {
        console.log('⏰ Timeout vérification (10min)');
        bot.disconnect();
        process.exit(0);
      }, 10 * 60 * 1000);
    }
    
    process.on('SIGINT', () => {
      bot.disconnect();
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Échec:', err);
    process.exit(1);
  }
}

// Only run main() if this file is executed directly, not when imported as a module
import { fileURLToPath } from 'url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

export { JKLMBot };

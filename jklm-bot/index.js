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
            // Le premier argument 'sender' est un objet: { nickname: 'Pseudo', ... }
            const nick = (typeof sender === 'object' && sender) ? sender.nickname : sender;
            console.log(`💬 [CHAT] ${nick}: ${message}`);
            this.handleChatMessage(nick, message);
          });

          // Écouter quand un joueur rejoint le LOBBY (pas le jeu)
          this.roomSocket.on('chatterAdded', (chatter) => {
            // Format: { nickname: "...", peerId: N, auth: { service: "discord", username: "...", id: "..." } }
            console.log(`👋 [LOBBY] Joueur au lobby:`, JSON.stringify(chatter));
            
            const nick = chatter.nickname;
            const auth = chatter.auth;
            
            // Message de bienvenue au lobby selon si le joueur est inscrit ou non
            if (this.expectedPlayers.length > 0) {
              const isExpected = this.findExpectedPlayer(nick, auth);
              const connectedCount = this.countConnectedExpectedPlayers();
              const totalExpected = this.expectedPlayers.length;
              
              if (isExpected) {
                // Joueur inscrit et attendu - seulement le compter, pas encore de message
                // Le message sera envoyé quand il rejoindra la partie (addPlayer)
                console.log(`✅ [LOBBY] ${nick} est inscrit (en attente qu'il rejoigne la partie)`);
              } else {
                // Joueur non inscrit - l'informer immédiatement
                this.sendChat(`👋 Hey ${nick} ! Rejoins www.psl-ranked.app pour participer à la ligue ranked`);
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
      console.log('📋 Setup reçu!');
      this.selfPeerId = data.selfPeerId;
      this.isLeader = data.selfRoles && data.selfRoles.includes('leader');
      
      // IMPORTANT: On ne rejoint PAS la manche pour rester spectateur
      // this.gameSocket.emit('joinRound');

      // Si on est leader, configurer les règles PSL
      if (this.isLeader) {
         console.log('👑 Je suis LEADER!');
         
         // Si on attend des joueurs, verrouiller les règles pour empêcher le démarrage
         if (this.expectedPlayers.length > 0) {
             console.log('🔒 Verrouillage des règles (en attente de joueurs)...');
             this.gameSocket.emit('setRulesLocked', false); // false = menu ouvert = bloque le jeu
             
             // Timer de 60s pour forcer le démarrage même si certains joueurs manquent
             this.lobbyTimeout = setTimeout(() => {
                 if (!this.allPlayersJoined && this.gameSocket?.connected && this.isLeader) {
                     const connectedCount = this.countConnectedExpectedPlayers();
                     const totalExpected = this.expectedPlayers.length;
                     console.log(`⏰ [TIMEOUT] Démarrage forcé après 60s (${connectedCount}/${totalExpected} joueurs présents)`);
                     this.sendChat(`⏰ Timeout ! Démarrage avec ${connectedCount}/${totalExpected} joueurs...`);
                     
                     this.allPlayersJoined = true; // Empêcher le démarrage normal
                     // Note: les règles ont déjà été appliquées au setup, pas besoin de les ré-appliquer
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
         
         // Si pas de joueurs attendus, lancer directement
         if (this.expectedPlayers.length === 0) {
             setTimeout(() => {
                 console.log('📤 Envoi startRoundNow...');
                 this.gameSocket.emit('startRoundNow');
             }, 3000);
         }
      }

      if (data.players) {
        data.players.forEach(p => {
          this.players.set(p.peerId, {
            nickname: p.profile?.nickname || `Player${p.peerId}`,
            peerId: p.peerId,
            score: 0,
          });
        });
        // Vérifier si les joueurs attendus sont déjà présents
        this.checkExpectedPlayers();
      }
    });

    this.gameSocket.on('addPlayer', (player) => {
      // Log complet pour debug
      console.log(`👤 [DEBUG] addPlayer complet:`, JSON.stringify(player, null, 2));
      
      const nick = player.profile?.nickname || `Player${player.profile?.peerId}`;
      const auth = player.profile?.auth;
      
      console.log(`👤 Joueur: ${nick}`, auth ? `(${auth.service}: ${auth.username || auth.id})` : '');
      
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
        
        if (isExpected) {
          // Joueur inscrit et attendu - afficher le compteur de progression
          this.sendChat(`✅ ${nick} a rejoint la partie ! (${connectedCount}/${totalExpected})`);
        }
        // Note: le message de bienvenue pour les non-inscrits est envoyé dans chatterAdded (lobby join)
      }

      // Vérifier si tous les joueurs attendus ont rejoint
      this.checkExpectedPlayers();
    });

    this.gameSocket.on('startChallenge', (challenge) => {
      console.log('❓ Question:', challenge.prompt?.substring(0, 50));
      this.roundCounter++;
      this.currentChallenge = {
        question: challenge.prompt,
        index: this.roundCounter,
        playerTimes: new Map() // peerId -> elapsedTime
      };
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
      }
    });

    this.gameSocket.on('endChallenge', (result) => {
      // result format: { source: "...", submitter: "...", details: "...", fastest: "PlayerName", ... }
      console.log('🏁 Fin du round!');
      
      // Enregistrer les réponses de ce round
      if (this.currentChallenge) {
        const { question, index, playerTimes } = this.currentChallenge;
        const answer = result.source;
        
        for (const [peerId, elapsedTime] of playerTimes.entries()) {
            const player = this.players.get(peerId);
            if (player) {
                this.matchAnswers.push({
                    peerId: peerId,
                    nickname: player.nickname,
                    roundIndex: index,
                    question: question,
                    answer: answer,
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
    });

    this.gameSocket.on('setMilestone', (milestone) => {
      if (milestone.lastRound?.winner) {
        console.log(`🏆 GAGNANT: ${milestone.lastRound.winner.nickname}`);
        this.sendChat(`👑 VICTOIRE DE ${milestone.lastRound.winner.nickname} !`);
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
    this.sendChat('🏆 RÉSULTATS FINAUX:');
    
    sorted.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.nickname}: ${p.score} pts`, p.auth ? `(${p.auth.service}:${p.auth.id})` : '');
      
      // Trouver si ce joueur était attendu pour récupérer ses infos
      const expectedInfo = this.findExpectedPlayer(p.nickname, p.auth);
      
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
        console.log(`📤 Envoi des résultats au callback: ${this.callbackUrl}`);
        fetch(this.callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                roomCode: this.roomCode,
                scores: this.gameResults,
                answers: this.matchAnswers,
                category: this.category
            })
        }).then(res => {
            console.log(`✅ Callback statut: ${res.status}`);
            this.disconnect();
            process.exit(0);
        }).catch(err => {
            console.error('❌ Erreur callback:', err);
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

  disconnect() {
    this.roomSocket?.disconnect();
    this.gameSocket?.disconnect();
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
        if (rules.tagOps && Array.isArray(rules.tagOps) && rules.tagOps.length > 0) {
          setTimeout(() => {
            if (!this.gameSocket?.connected) return;
            console.log('  📁 setTagOps:', JSON.stringify(rules.tagOps));
            this.gameSocket.emit('setTagOps', rules.tagOps);
            console.log('  ✓ tagOps appliqués');
          }, 200);
        }
      }, 200);
    }, 300);
  }

  findExpectedPlayer(nickname, auth) {
    // Cherche si ce joueur était attendu (pour récupérer son userId)
    if (!auth && !nickname) return null;
    
    for (const exp of this.expectedPlayers) {
      // Match par auth (Discord/Twitch ID)
      if (auth?.service?.toLowerCase() === exp.service && auth?.id === exp.id) {
        return exp;
      }
      // Match par username si pas d'ID
      if (exp.username && nickname?.toLowerCase() === exp.username) {
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

    // Construire la liste des joueurs présents avec leur auth
    // On utilise auth.id car c'est l'ID Discord stocké dans la BD
    const joinedPlayers = [...this.players.values()].map(p => ({
      service: p.auth?.service?.toLowerCase() || 'unknown',
      id: p.auth?.id || null,
      username: p.auth?.username?.toLowerCase() || p.nickname.toLowerCase()
    }));

    console.log(`🔍 Joueurs présents:`);
    joinedPlayers.forEach(p => console.log(`  - ${p.service}:${p.username} (id: ${p.id})`));

    // Vérifier quels joueurs attendus sont manquants
    // On match sur service + id OU service + username (pour flexibilité)
    const missing = this.expectedPlayers.filter(exp => 
      !joinedPlayers.some(jp => {
        if (jp.service !== exp.service) return false;
        // Matcher par ID si disponible, sinon par username
        if (exp.id && jp.id) return jp.id === exp.id;
        return jp.username === exp.username?.toLowerCase();
      })
    );

    console.log(`🔍 Attendus: ${this.expectedPlayers.length}, présents: ${joinedPlayers.length}, manquants: ${missing.length}`);
    if (missing.length > 0) {
      console.log(`⏳ Manquants:`);
      missing.forEach(p => console.log(`  -Service: ${p.service}, ID: ${p.id}, Username: "${p.username}"`));
    }

    if (missing.length === 0) {
      this.allPlayersJoined = true;
      console.log('✅ Tous les joueurs attendus ont rejoint!');
      
      // Annuler le timeout de démarrage forcé
      if (this.lobbyTimeout) {
        clearTimeout(this.lobbyTimeout);
        this.lobbyTimeout = null;
      }
      
      // Déverrouiller les règles et lancer la partie
      setTimeout(() => {
        if (this.gameSocket?.connected) {
          if (this.isLeader) {
            // Note: les règles ont déjà été appliquées au setup, pas besoin de les ré-appliquer
            console.log('🔓 Déverrouillage des règles...');
            this.gameSocket.emit('setRulesLocked', true); // true = menu fermé = permet le jeu
          }
          console.log('📤 Envoi startRoundNow (tous joueurs présents)...');
          this.gameSocket.emit('startRoundNow');
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

  handleChatMessage(nickname, message) {
    if (!this.verifyMode || !this.verifyCode) return;

    // Vérifier si le message contient le code attendu
    if (message.includes(this.verifyCode)) {
      console.log(`✅ Code ${this.verifyCode} trouvé de ${nickname}!`);
      this.sendVerificationCallback(nickname);
    }
  }

  async sendVerificationCallback(nickname) {
    if (!this.callbackUrl) return;

    try {
      const response = await fetch(this.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: this.verifyCode,
          nickname,
          roomCode: this.roomCode
        })
      });

      if (response.ok) {
        console.log(`✅ Vérification réussie pour ${nickname}!`);
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
    } else if (args[i].startsWith('http')) {
      callbackUrl = args[i];
    } else if (args[i].length === 4 && !args[i].startsWith('-')) {
      roomCode = args[i];
    }
  }
  
  try {
    // Mode création automatique
    if (shouldCreate) {
      let roomName = 'PSL Ranked';
      if (verifyMode) {
        roomName = 'PSL Verif';
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
        roomName = `[PSL Bot Ranked] - ${catLabel}`;
      }
      console.log(`🏗️ Mode création automatique (${roomName})...`);
      const result = await bot.createRoom({ name: roomName, isPublic: false });
      roomCode = result.roomCode;
      console.log(`🎮 Room créée: ${roomCode}`);
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

main();
export { JKLMBot };

/**
 * PSL Discord Bot
 * 
 * Envoie des notifications Discord quand un joueur est seul en queue depuis 15s.
 * Expose un endpoint webhook pour recevoir les notifications de l'app Next.js.
 */

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  // Mapping catégorie → salon Discord
  CHANNELS: {
    'GP_FR': process.env.DISCORD_CHANNEL_GP_FR || '1451974366505074819',
    'MS_EN': process.env.DISCORD_CHANNEL_MS_EN || '1452082516503695411',
    'ANIME': process.env.DISCORD_CHANNEL_ANIME || '1452084152588439572',
    'FLAGS': process.env.DISCORD_CHANNEL_FLAGS || '1452084191712903363',
    // Fallback pour les modes sans canal dédié
    'NOFILTER_FR': process.env.DISCORD_CHANNEL_NF_FR || '1451974366505074819',
    'NOFILTER_EN': process.env.DISCORD_CHANNEL_NF_EN || '1452082516503695411',
  },
  
  // Mapping catégorie → rôle Discord
  ROLES: {
    'GP_FR': process.env.DISCORD_ROLE_GP_FR || '1452078988154634360',
    'MS_EN': process.env.DISCORD_ROLE_MS_EN || '1452079050183938099',
    'ANIME': process.env.DISCORD_ROLE_ANIME || '1452079098972340307',
    'FLAGS': process.env.DISCORD_ROLE_FLAGS || '1452079158300643371',
    // Fallback pour les modes sans rôle dédié
    'NOFILTER_FR': process.env.DISCORD_ROLE_NF_FR || '1452078988154634360',
    'NOFILTER_EN': process.env.DISCORD_ROLE_NF_EN || '1452079050183938099',
  },
  
  // Labels pour les messages
  LABELS: {
    'GP_FR': 'Grand Public [FR] 🍿',
    'MS_EN': 'Mainstream [EN] 🍿',
    'ANIME': 'Anime 🎌',
    'FLAGS': 'Drapeaux 🚩',
    'NOFILTER_FR': 'Sans Filtre [FR] 🔥',
    'NOFILTER_EN': 'No Filter [EN] 🔥',
  },
  
  // Cooldown entre deux pings du même rôle (en ms)
  COOLDOWN_MS: parseInt(process.env.DISCORD_NOTIFY_COOLDOWN_MS) || 3 * 60 * 1000, // 3 minutes
  
  // Port pour le serveur webhook
  PORT: parseInt(process.env.DISCORD_BOT_PORT) || 3001,
};

// ==========================================
// STATE
// ==========================================

// Dernier ping par catégorie (pour le cooldown)
const lastPingTime = new Map();

// ==========================================
// DISCORD CLIENT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once('ready', () => {
  console.log(`🤖 Bot Discord connecté: ${client.user.tag}`);
  console.log(`📡 Serveurs: ${client.guilds.cache.size}`);
});

// ==========================================
// NOTIFICATION LOGIC
// ==========================================

async function sendQueueNotification(category, playerName, queueCount, type = 'join') {
  const channelId = CONFIG.CHANNELS[category];
  const roleId = CONFIG.ROLES[category];
  const label = CONFIG.LABELS[category] || category;
  
  if (!channelId || !roleId) {
    console.log(`⚠️ Pas de config pour la catégorie: ${category}`);
    return { success: false, reason: 'no_config' };
  }
  
  // Pour les notifications "join", vérifier le cooldown
  // Pour les notifications "match_ready", PAS de cooldown
  if (type === 'join') {
    const lastPing = lastPingTime.get(category) || 0;
    const now = Date.now();
    const remaining = CONFIG.COOLDOWN_MS - (now - lastPing);
    
    if (remaining > 0) {
      console.log(`⏳ Cooldown actif pour ${category}: ${Math.ceil(remaining / 1000)}s restantes`);
      return { success: false, reason: 'cooldown', remainingMs: remaining };
    }
  }
  
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.log(`❌ Canal non trouvé: ${channelId}`);
      return { success: false, reason: 'channel_not_found' };
    }
    
    // Detect if category is English
    const isEnglish = category.includes('EN'); // MS_EN, NOFILTER_EN
    
    // Construire le message selon le type (anonyme + localisé)
    let message;
    if (type === 'match_ready') {
      message = isEnglish
        ? `🚀 **Match starting!** A game in **${label}** is about to begin!\n\n<@&${roleId}> Join now on [psl-ranked.app](https://www.psl-ranked.app/dashboard)! (30s before launch)`
        : `🚀 **Match en préparation !** Une partie en **${label}** va bientôt commencer !\n\n<@&${roleId}> Rejoignez vite sur [psl-ranked.app](https://www.psl-ranked.app/dashboard)! (30s avant lancement)`;
    } else {
      // ANONYME: "Un joueur" au lieu du pseudo
      message = isEnglish
        ? `🎮 **A player** is looking for a match in **${label}**!\n\n<@&${roleId}> Join matchmaking on [psl-ranked.app](https://www.psl-ranked.app/dashboard)!`
        : `🎮 **Un joueur** cherche une partie en **${label}** !\n\n<@&${roleId}> Rejoignez le matchmaking sur [psl-ranked.app](https://www.psl-ranked.app/dashboard)!`;
    }
    
    await channel.send(message);
    
    // Mettre à jour le cooldown uniquement pour les notifications "join"
    if (type === 'join') {
      lastPingTime.set(category, Date.now());
    }
    
    console.log(`✅ Notification ${type} envoyée: ${category} (anonyme)`);
    return { success: true };
    
  } catch (err) {
    console.error(`❌ Erreur envoi notification:`, err);
    return { success: false, reason: 'error', error: err.message };
  }
}

// ==========================================
// EXPRESS WEBHOOK SERVER
// ==========================================

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    bot: client.isReady() ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// Endpoint pour recevoir les notifications de l'app Next.js
app.post('/notify', async (req, res) => {
  const { category, playerName, queueCount, type, secret } = req.body;
  
  // Vérification simple du secret (optionnel mais recommandé)
  if (process.env.DISCORD_WEBHOOK_SECRET && secret !== process.env.DISCORD_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  
  if (!category || !playerName) {
    return res.status(400).json({ error: 'Missing category or playerName' });
  }
  
  console.log(`📥 Notification reçue: ${category} - ${playerName} (${queueCount} en queue, type: ${type || 'join'})`);
  
  const result = await sendQueueNotification(category, playerName, queueCount, type || 'join');
  res.json(result);
});

// ==========================================
// STARTUP
// ==========================================

async function start() {
  const token = process.env.DISCORD_BOT_TOKEN;
  
  if (!token) {
    console.error('❌ DISCORD_BOT_TOKEN manquant !');
    process.exit(1);
  }
  
  // Démarrer le serveur Express
  app.listen(CONFIG.PORT, () => {
    console.log(`🌐 Webhook server running on port ${CONFIG.PORT}`);
  });
  
  // Connecter le bot Discord
  await client.login(token);
}

start().catch(console.error);

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
    'NOFILTER_FR': process.env.DISCORD_CHANNEL_GP_FR || '1451974366505074819',
    'NOFILTER_EN': process.env.DISCORD_CHANNEL_MS_EN || '1452082516503695411',
  },
  
  // Mapping catégorie → rôle Discord
  ROLES: {
    'GP_FR': process.env.DISCORD_ROLE_GP_FR || '1452078988154634360',
    'MS_EN': process.env.DISCORD_ROLE_MS_EN || '1452079050183938099',
    'ANIME': process.env.DISCORD_ROLE_ANIME || '1452079098972340307',
    'FLAGS': process.env.DISCORD_ROLE_FLAGS || '1452079158300643371',
    // Fallback pour les modes sans rôle dédié
    'NOFILTER_FR': process.env.DISCORD_ROLE_GP_FR || '1452078988154634360',
    'NOFILTER_EN': process.env.DISCORD_ROLE_MS_EN || '1452079050183938099',
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
  COOLDOWN_MS: parseInt(process.env.DISCORD_NOTIFY_COOLDOWN_MS) || 5 * 60 * 1000, // 5 minutes
  
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

async function sendQueueNotification(category, playerName, queueCount) {
  const channelId = CONFIG.CHANNELS[category];
  const roleId = CONFIG.ROLES[category];
  const label = CONFIG.LABELS[category] || category;
  
  if (!channelId || !roleId) {
    console.log(`⚠️ Pas de config pour la catégorie: ${category}`);
    return { success: false, reason: 'no_config' };
  }
  
  // Vérifier le cooldown
  const lastPing = lastPingTime.get(category) || 0;
  const now = Date.now();
  const remaining = CONFIG.COOLDOWN_MS - (now - lastPing);
  
  if (remaining > 0) {
    console.log(`⏳ Cooldown actif pour ${category}: ${Math.ceil(remaining / 1000)}s restantes`);
    return { success: false, reason: 'cooldown', remainingMs: remaining };
  }
  
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.log(`❌ Canal non trouvé: ${channelId}`);
      return { success: false, reason: 'channel_not_found' };
    }
    
    // Construire le message
    const message = `🎮 **${playerName}** cherche une partie en **${label}** !\n\n` +
                    `<@&${roleId}> Rejoignez le matchmaking sur [psl-ranked.app](https://www.psl-ranked.app) !`;
    
    await channel.send(message);
    
    // Mettre à jour le cooldown
    lastPingTime.set(category, now);
    
    console.log(`✅ Notification envoyée: ${category} (joueur: ${playerName})`);
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
  const { category, playerName, queueCount, secret } = req.body;
  
  // Vérification simple du secret (optionnel mais recommandé)
  if (process.env.DISCORD_WEBHOOK_SECRET && secret !== process.env.DISCORD_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  
  if (!category || !playerName) {
    return res.status(400).json({ error: 'Missing category or playerName' });
  }
  
  console.log(`📥 Notification reçue: ${category} - ${playerName} (${queueCount} en queue)`);
  
  const result = await sendQueueNotification(category, playerName, queueCount);
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

# 📦 PSL Changelog - Version 1.1

## 🇫🇷 Annonce Discord (Français)

```
🚀 **MISE À JOUR PSL v1.1** 🚀

Salut à tous ! Voici les nouveautés de cette mise à jour :

🎖️ **Nouveaux Seuils de Rangs** 
Les rangs ont été recalibrés pour être plus accessibles en début de saison :
• 🟤 Bronze : 0-899
• ⚪ Argent : 900-1049
• 🟡 Or : 1050-1199
• 🔵 Platine : 1200-1399
• 💎 Diamant : 1400-1599
• 👑 Maître : 1600+

📊 **Barre d'XP avec Sélecteur de Catégorie**
La nouvelle barre d'XP sur le dashboard affiche ta progression vers le prochain rang, avec un sélecteur pour voir ton MMR dans chaque catégorie jouée.

📜 **Onglet "Matchs Récents"**
Tu peux maintenant voir les 50 derniers matchs terminés avec les scores et les changements de MMR dans l'onglet Matchs !

🤖 **Messages du Bot Localisés**
Le bot parle maintenant anglais dans les lobbies EN (MS EN, NF EN) et français partout ailleurs. Les joueurs non-inscrits reçoivent un lien Discord dans le message de bienvenue.

⚡ **Bonus d'Upset Amélioré**
Battre un joueur avec +100 MMR donne maintenant un bonus (avant : +200). Perdre contre un joueur avec -100 MMR donne une pénalité plus forte.

🔧 **Corrections**
• MMR par catégorie utilisé partout (plus de MMR global)
• Matching des joueurs amélioré (plus de "3/3 mais pas de lancement")
• Refresh automatique du dashboard après un match
• Meilleur responsive mobile sur le leaderboard

🎮 Bon jeu à tous !
```

---

## 🇬🇧 Discord Announcement (English)

```
🚀 **PSL UPDATE v1.1** 🚀

Hey everyone! Here's what's new in this update:

🎖️ **New Rank Thresholds**
Ranks have been recalibrated to be more accessible at the start of the season:
• 🟤 Bronze: 0-899
• ⚪ Silver: 900-1049
• 🟡 Gold: 1050-1199
• 🔵 Platinum: 1200-1399
• 💎 Diamond: 1400-1599
• 👑 Master: 1600+

📊 **XP Bar with Category Selector**
The new XP bar on the dashboard shows your progress to the next rank, with a selector to view your MMR in each category you've played.

📜 **"Recent Matches" Tab**
You can now see the last 50 completed matches with scores and MMR changes in the Matches tab!

🤖 **Localized Bot Messages**
The bot now speaks English in EN lobbies (MS EN, NF EN) and French everywhere else. Unregistered players receive a Discord link in the welcome message.

⚡ **Improved Upset Bonus**
Beating a player with +100 MMR now gives a bonus (was +200). Losing to a player with -100 MMR gives a stronger penalty.

🔧 **Bug Fixes**
• Category-specific MMR used everywhere (no more global MMR)
• Improved player matching (no more "3/3 but no launch")
• Auto-refresh dashboard after a match
• Better mobile responsiveness on the leaderboard

🎮 Have fun playing!
```

---

## 📋 Full Technical Changelog

### ✨ Features

| Feature | Description |
|---------|-------------|
| **XP Bar** | New premium XP bar component with glow/shimmer animations, category selector |
| **Recent Matches Tab** | New tab showing last 50 completed matches with player stats |
| **Adjusted Rank Thresholds** | Tighter rank ranges for early season (Bronze 0-899 → Master 1600+) |
| **Upset Threshold** | Reduced from 200 to 100 points for bonus/penalty triggers |
| **Bot Localization** | All bot messages (welcome, join, victory, results) now localized FR/EN |
| **Discord Link in Bot** | Unregistered players see Discord invite in welcome message |
| **FR/EN Badge** | Categories with same emoji now show FR/EN badge to differentiate |
| **Google Analytics 4** | Integration for usage tracking |
| **Speed Records Search** | Live search with 500ms debounce |
| **Dashboard Refresh** | MMR and match history auto-refresh after game ends |

### 🐛 Bug Fixes

| Fix | Description |
|-----|-------------|
| **Category MMR in Queue** | Queue now uses category-specific MMR instead of global |
| **Profile Page Global MMR** | Removed global MMR usage, only category-specific shown |
| **Player Matching** | Consistent matching logic between count and start trigger |
| **Speed Records Duplicates** | Keep only best time per user+answer combination |
| **JKLM Staff Verification** | Use permanent username instead of display nickname |
| **Bot Timeout Handling** | Robust timeout with warnings at 30s and 50s |

### 🔧 Improvements

| Improvement | Description |
|-------------|-------------|
| **Debug Logs (Queue)** | Enhanced logging for clearMatch and player operations |
| **Debug Logs (Bot)** | Detailed callback body/response logging |
| **Debug Logs (Start)** | isLeader and gameSocket status logging |
| **Mobile Responsiveness** | Leaderboard and Matches pages improved for mobile |

---

## 🔢 Commits (19)

```
2dbb337 fix: Consistent player matching in checkExpectedPlayers
d788d86 debug: Add detailed logs for game start issue diagnosis
7b6849a feat: Add enhanced debug logs to Queue and JKLM Bot
31da672 feat: Adjust rank thresholds for early season and reduce upset threshold
660673b fix: Remove www. from discord.gg URL
fa24285 fix: Add www. prefix to URLs in bot messages
3ca03b2 feat: Add Discord link to welcome message and localize bot messages
db57136 feat: Add Recent Matches tab and improve mobile responsiveness
c00c1f4 refactor: remove global MMR usage from profile page and components
f900299 feat: add XP bar with category selector and fix category MMR in queue
eadfb88 docs: add roadmap with missing features analysis
f1e1e64 fix(jklm-verify): use auth.username for staff accounts
7a7ebd4 feat(speed-records): live search with 500ms debounce
0c48878 fix(speed-records): keep only best time per user+answer
6de6753 feat(dashboard): dynamic refresh of MMR and match history
068faed feat(play-card): add FR/EN badge to differentiate categories
ebaab64 feat(jklm-bot): robust timeout handling with warnings
0a1a0f3 feat(jklm-bot): localized welcome messages
01c1134 feat: add Google Analytics 4 integration
```

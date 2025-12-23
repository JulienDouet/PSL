# PSL - PopSauce League

## 🎯 Vision du projet

**PSL (PopSauce League)** est une plateforme de matchmaking ranked pour le jeu Popsauce sur JKLM.fun.

### Pitch
> Je me connecte sur la plateforme, je lance une recherche de match. Une fois qu'assez de joueurs sont en recherche, un bot crée une partie Popsauce, partage le lien, les joueurs jouent, puis les résultats sont récupérés pour alimenter un système de MMR et classement.

### Contexte
- Premier système de ranked pour Popsauce français
- Communauté estimée : ~100 inscrits, max 10 joueurs simultanés
- Inspiré par un tournoi anglais non-officiel

---

## 🎮 Règles du jeu Popsauce

### Déroulement d'une partie

1. **Question affichée** : Une question (texte ou image) apparaît à l'écran
2. **Première réponse** : Le premier joueur à répondre correctement gagne **10 points**
3. **Réponses suivantes** : Les points diminuent selon le temps écoulé depuis la 1ère réponse
   - 1 seconde après → **9 points**
   - 2 secondes après → **8 points**
   - 3 secondes après → **7 points**
   - ... jusqu'à minimum **1 point**

### Système de points

```
┌─────────────────────────────────────────────────────────┐
│  QUESTION POSÉE                                         │
│                                                         │
│  [0s] Player1 répond juste ──────────────► +10 pts     │
│  [1s] Player2 répond juste ──────────────► +9 pts      │
│  [3s] Player3 répond juste ──────────────► +7 pts      │
│  [8s] Player4 répond juste ──────────────► +2 pts      │
│  [10s+] Player5 répond juste ────────────► +1 pt       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Condition de victoire

- **Objectif** : Atteindre ou dépasser **150 points**
- **Pas d'égalité** : Si deux joueurs atteignent 150 en même temps (égalité), la partie **continue** jusqu'à ce qu'un joueur soit seul en tête
- **Conséquence pour PSL** : Le scénario "égalité de points finale" est **impossible**

### Types de questions

| Type | Description |
|------|-------------|
| **Texte** | Question écrite, réponse à taper |
| **Image** | Photo/illustration, identifier le sujet |

---

## 🔐 Système d'authentification

### Inscription PSL
- Email + mot de passe OU OAuth Discord/Google
- Compte PSL créé

### Liaison avec Popsauce
Les joueurs peuvent se connecter à Popsauce via 3 providers :

| Provider | Vérification |
|----------|--------------|
| **Discord** | OAuth automatique ✅ |
| **Twitch** | OAuth automatique ✅ |
| **JKLM.fun natif** | Code de vérification dans le chat |

### Vérification JKLM.fun natif
1. Le joueur déclare son pseudo JKLM
2. PSL génère un code unique : `PSL-7X3K9`
3. Le joueur rejoint une partie de vérif et tape le code dans le chat
4. Le bot voit le code → valide l'identité

### Flow OAuth détaillé

```
┌─────────────────────────────────────────────────────────────┐
│                     FLOW D'INSCRIPTION                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Utilisateur clique "Se connecter avec Discord"         │
│     ↓                                                       │
│  2. Redirection vers Discord OAuth                          │
│     ↓                                                       │
│  3. Utilisateur autorise PSL                                │
│     ↓                                                       │
│  4. Discord redirige vers PSL avec code                     │
│     ↓                                                       │
│  5. PSL échange code → access_token                         │
│     ↓                                                       │
│  6. PSL récupère profil Discord (id, username, avatar)      │
│     ↓                                                       │
│  7. Création/connexion compte PSL                           │
│     ↓                                                       │
│  8. Session créée (JWT ou cookie)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Données récupérées par provider

| Provider | ID unique | Username | Avatar | Email |
|----------|-----------|----------|--------|-------|
| Discord | ✅ | ✅ | ✅ | ✅ |
| Twitch | ✅ | ✅ | ✅ | ✅ |
| JKLM | ❌ (pseudo) | ✅ | ❌ | ❌ |

### Gestion des sessions

```javascript
// NextAuth.js configuration
export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
    TwitchProvider({
      clientId: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        mmr: user.mmr,
        rank: getRank(user.mmr),
      },
    }),
  },
};
```

### Sécurité

| Mesure | Description |
|--------|-------------|
| **HTTPS only** | Tout le trafic chiffré |
| **HttpOnly cookies** | Tokens non accessibles en JS |
| **CSRF protection** | Token anti-CSRF sur les forms |
| **Rate limiting** | Max 10 tentatives de login/min |

---

## 🎮 UX Matchmaking

### Flow utilisateur
```
1. Joueur clique "Rechercher" → Rejoint la queue
2. 2 joueurs en queue → Timer de 30s démarre
3. Fin du timer OU 6+ joueurs → Bot crée la partie
4. Lien partagé → Joueurs cliquent pour rejoindre Popsauce
5. Partie jouée → Résultats récupérés
```

### Interface matchmaking
```
┌──────────────────────────────────┐
│  🎮 RECHERCHE DE PARTIE          │
├──────────────────────────────────┤
│  4 joueurs en ligne              │
│  2 en recherche                  │
│                                  │
│  ┌────────────────────────────┐  │
│  │   🟢 Hyceman               │  │
│  │   🟢 Player2               │  │
│  │   ⏳ En attente: 00:23     │  │
│  └────────────────────────────┘  │
│                                  │
│  Partie lancée à 2+ joueurs      │
│  ou après 90 secondes            │
│                                  │
│  [🎮 REJOINDRE LA RECHERCHE]     │
└──────────────────────────────────┘
```

### Paramètres
- Minimum : 2 joueurs
- Maximum : 10 joueurs
- Timer d'attente : 90 secondes
- Pas de filtre MMR (communauté trop petite)

### Catégories de jeu (V2)

Matchmaking et classement **séparés par catégorie**.

#### Catégories disponibles

| Catégorie | Code | Description | Filtres Popsauce |
|-----------|------|-------------|------------------|
| **Grand Public** | `GP` | Défaut, toutes questions | Aucun filtre |
| **Anime** | `ANIME` | Anime/Manga uniquement | Anime, Manga |
| **Drapeaux** | `FLAGS` | Drapeaux only | Flags |
| **Musique** | `MUSIC` | Musique uniquement | Music |
| **Films** | `MOVIES` | Cinéma uniquement | Movies |
| **Jeux Vidéo** | `GAMES` | Gaming uniquement | Games |

#### Interface sélection

```
┌──────────────────────────────────┐
│  🎮 RECHERCHE DE PARTIE          │
├──────────────────────────────────┤
│                                  │
│  Catégorie :                     │
│  ┌────────────────────────────┐  │
│  │ [🌍 GP ▼]                  │  │
│  │  ├─ 🌍 Grand Public (12)   │  │
│  │  ├─ 🎌 Anime (3)           │  │
│  │  ├─ 🚩 Drapeaux (1)        │  │
│  │  ├─ 🎵 Musique (0)         │  │
│  │  └─ 🎬 Films (2)           │  │
│  └────────────────────────────┘  │
│                                  │
│  (12) = joueurs en recherche     │
│                                  │
│  [🎮 REJOINDRE]                  │
└──────────────────────────────────┘
```

#### Classements par catégorie

Chaque joueur a un **MMR séparé** par catégorie :

```
Profil Hyceman :

🌍 Grand Public : 2450 MMR (Grand Maître #1)
🎌 Anime        : 1850 MMR (Diamant #5)
🚩 Drapeaux     : 1200 MMR (Argent #42)
🎵 Musique      : Non classé (0 parties)
```

#### Schéma Prisma

```prisma
model UserCategoryMMR {
  id         String   @id @default(cuid())
  userId     String
  category   Category
  mmr        Int      @default(1000)
  gamesPlayed Int     @default(0)
  
  user       User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, category])
}

enum Category {
  GP
  ANIME
  FLAGS
  MUSIC
  MOVIES
  GAMES
}
```

#### Leaderboard par catégorie

```
┌─────────────────────────────────────────┐
│ 🏆 CLASSEMENT                           │
├─────────────────────────────────────────┤
│                                         │
│ [🌍 GP] [🎌 Anime] [🚩 Flags] [🎵 ...]  │
│                                         │
│ 🌍 GRAND PUBLIC                         │
│ ──────────────────────                  │
│ 1. 🏆 Hyceman      2450 MMR             │
│ 2. 💠 Player2      2100 MMR             │
│ 3. 💠 Player3      2050 MMR             │
│                                         │
└─────────────────────────────────────────┘
```

### Bonus communauté
- Notification Discord : "2 joueurs en recherche, rejoins maintenant !"
- Affichage des horaires de pic

---

## 📊 Système MMR

### V1 - Système hybride simple

```
MMR de base : 1000

Après chaque partie :
  1er sur 6 joueurs : +30
  2ème             : +15
  3ème             : +5
  4ème             : -5
  5ème             : -15
  6ème             : -25

Bonus/Malus si écart de MMR moyen :
  Si tu bats des joueurs +200 MMR : bonus +10
  Si tu perds contre des -200 MMR : malus -10
```

### Rangs (Badges)

Système de rangs basé sur le MMR, similaire aux jeux compétitifs.

#### Paliers de rang

| Rang | MMR requis | Icône |
|------|------------|-------|
| **Bronze** | 0 - 999 | 🥉 |
| **Argent** | 1000 - 1299 | ⚪ |
| **Or** | 1300 - 1599 | 🥇 |
| **Platine** | 1600 - 1899 | 💎 |
| **Diamant** | 1900 - 2199 | 💠 |
| **Maître** | 2200+ | 👑 |
| **Grand Maître** | Top 5 classement | 🏆 |

> **Grand Maître** : Les 5 premiers du classement, peu importe leur MMR.

#### Affichage en lobby

Quand un joueur rejoint, on affiche :

```
🏆 #1 | Hyceman | Grand Maître | 2450 MMR
💠 #8 | Player2 | Diamant | 2100 MMR
🥇 #42 | Player3 | Or | 1450 MMR
```

#### Top 3 - Brillance spéciale

Les 3 premiers du classement ont un effet visuel :
- 🥇 **#1** : Badge doré brillant
- 🥈 **#2** : Badge argenté brillant  
- 🥉 **#3** : Badge bronze brillant

#### Schéma Prisma (extension)

```prisma
model User {
  // ... autres champs
  mmr          Int      @default(1000)
  
  // Calculé dynamiquement via une fonction
  // rank: getRank(mmr, leaderboardPosition)
}

// Fonction utilitaire
function getRank(mmr: number, position: number): Rank {
  if (position <= 5) return 'GRAND_MASTER';
  if (mmr >= 2200) return 'MASTER';
  if (mmr >= 1900) return 'DIAMOND';
  if (mmr >= 1600) return 'PLATINUM';
  if (mmr >= 1300) return 'GOLD';
  if (mmr >= 1000) return 'SILVER';
  return 'BRONZE';
}
```

### Calibration (nouveaux joueurs)

Les nouveaux joueurs font **5 parties de calibration** avec gains/pertes doublés.

#### Fonctionnement

```
1. Nouveau joueur → MMR provisoire = 1000
2. Pendant les 5 premières parties :
   - Badge "En calibration"
   - Gains/pertes × 2
3. Après 5 parties :
   - Rang révélé
   - Gains/pertes normaux
```

#### Code

```javascript
const CALIBRATION_MULTIPLIER = 2.0;
const CALIBRATION_GAMES = 5;

function calculateMMRChange(player, result) {
  let change = normalMMRCalculation(player, result);
  
  if (player.gamesPlayed < CALIBRATION_GAMES) {
    change *= CALIBRATION_MULTIPLIER;
  }
  
  return change;
}
```

#### Affichage

```
Pendant :  ❓ | Hyceman | En calibration (3/5) | ~1200 MMR
Après :    💠 #8 | Hyceman | Diamant | 2100 MMR
```

---

### 🏅 Achievements (Badges permanents)

Badges débloqués par accomplissements, différents des rangs de saison.

#### Achievements de progression

| Badge | Condition | Icône |
|-------|-----------|-------|
| **Première victoire** | Gagner 1 partie | 🎉 |
| **Vétéran** | 100 parties jouées | 🎖️ |
| **Centurion** | 100 victoires | 💯 |
| **Millionnaire** | 1000 parties jouées | 🏆 |

#### Achievements de performance

| Badge | Condition | Icône |
|-------|-----------|-------|
| **Imbattable** | 10 victoires d'affilée | 🔥 |
| **Comeback** | Gagner à 149-150 | 🔄 |
| **Écrasant** | Gagner 150-50 ou moins | 💪 |
| **Giant Slayer** | Battre un Grand Maître | ⚔️ |
| **Rapide** | Répondre 1er à 10 questions d'affilée | ⚡ |

#### Achievements spéciaux

| Badge | Condition | Icône |
|-------|-----------|-------|
| **Champion** | Finir #1 d'une saison | 👑 |
| **Podium** | Finir top 3 d'une saison | 🥇 |
| **OG** | Jouer pendant la beta | 🌟 |

---

### 📊 Classements alternatifs

En plus du classement MMR principal :

| Classement | Critère | Période |
|------------|---------|---------|
| **MMR** | MMR actuel | Saison |
| **Winrate** | % de victoires (min 20 parties) | Saison |
| **Victoires** | Nombre total de wins | Saison |
| **Streak** | Plus longue série de victoires | All-time |
| **Parties jouées** | Activité | Saison |
| **Giant Killer** | Victoires contre +500 MMR | Saison |

#### Filtres disponibles

```
[Saison actuelle ▼] [All-time]
[Tous les rangs ▼] [Diamant+] [Or et moins]
[Top 100] [Autour de moi]
```

---

### 📖 Onboarding (nouveaux joueurs)

#### Étapes

```
1. Connexion OAuth (Discord/Twitch)
   ↓
2. Écran de bienvenue
   "Bienvenue sur PSL ! Le ranked pour Popsauce."
   ↓
3. Explication rapide (3 slides)
   - Comment fonctionne le matchmaking
   - Comment le MMR est calculé
   - Les rangs et saisons
   ↓
4. Première recherche
   "Tu es prêt ! Lance ta première recherche."
   ↓
5. Calibration (5 parties)
   ↓
6. Rang révélé
   "Félicitations ! Tu es Platine ! 💎"
```

#### Tips contextuels

| Moment | Message |
|--------|---------|
| Première défaite | "Pas grave ! Tu apprendras de chaque partie." |
| Première victoire | "GG ! Continue comme ça !" |
| Fin calibration | "Tu es maintenant classé ! Ton rang peut évoluer." |
| Première saison | "La saison se termine le 31/12. Vise le top !" |

---

### 👁️ Mode spectateur

Regarder des parties PSL en direct directement sur Popsauce.

#### Fonctionnement

```
1. Page "Parties en cours" sur PSL
   Liste des matchs PSL actifs avec joueurs
   
2. Cliquer sur "Regarder"
   → Ouvre le lien du lobby Popsauce
   
3. Spectateur sur Popsauce
   → Utilise le mode spectateur natif de JKLM.fun
```

#### Interface PSL

```
┌─────────────────────────────────────────┐
│ 🔴 PARTIES EN COURS                     │
├─────────────────────────────────────────┤
│                                         │
│ Match #1234 (en cours)                  │
│ 👥 Hyceman, Player2, Player3            │
│ ⏱️ Démarré il y a 5 min                  │
│ [🔗 Regarder sur Popsauce]              │
│                                         │
│ Match #1235 (en cours)                  │
│ 👥 Pro1, Pro2, Rival                     │
│ ⏱️ Démarré il y a 2 min                  │
│ [🔗 Regarder sur Popsauce]              │
│                                         │
└─────────────────────────────────────────┘
```

> **Note** : Le mode spectateur utilise les fonctionnalités natives de JKLM.fun, pas de développement custom.

---

### 📊 XP Bar (progression visuelle)

Barre de progression vers le prochain rang.

#### Affichage

```
┌─────────────────────────────────────────┐
│ 💎 PLATINE                              │
│ 1650 MMR                                │
│ ████████████░░░░░░░░ 50 MMR → Diamant   │
│                                         │
│ Prochain rang : Diamant (1700+)         │
└─────────────────────────────────────────┘
```

#### Calcul

```javascript
function getProgress(mmr) {
  const ranks = [
    { name: 'Bronze', min: 0, max: 999 },
    { name: 'Argent', min: 1000, max: 1299 },
    { name: 'Or', min: 1300, max: 1599 },
    { name: 'Platine', min: 1600, max: 1899 },
    { name: 'Diamant', min: 1900, max: 2199 },
    { name: 'Maître', min: 2200, max: Infinity },
  ];
  
  const current = ranks.find(r => mmr >= r.min && mmr <= r.max);
  const progress = (mmr - current.min) / (current.max - current.min + 1);
  
  return { rank: current.name, progress, remaining: current.max - mmr + 1 };
}
```

---

### 🏅 Best of stats (records personnels)

Mettre en avant les meilleures performances du joueur.

#### Stats affichées

| Stat | Description |
|------|-------------|
| **Meilleure streak** | Plus longue série de victoires |
| **Victoire la plus rapide** | Partie gagnée en moins de X minutes |
| **Écart max** | Plus gros écart de score (ex: 150-23) |
| **Upset record** | Plus gros MMR gap battu |
| **Réponse la plus rapide** | Temps de réponse min |
| **Rang max atteint** | Plus haut rang historique |

#### Affichage profil

```
┌─────────────────────────────────────────┐
│ 🏅 RECORDS PERSONNELS                   │
│                                         │
│ 🔥 Meilleure streak : 12 victoires      │
│ ⚡ Réponse la + rapide : 0.8s           │
│ 💪 Écart max : 150-18                   │
│ ⚔️ Upset record : +850 MMR battu        │
│ 👑 Rang max : Maître (#12)              │
└─────────────────────────────────────────┘
```

---

### 🏆 Tournois automatiques

Tournois récurrents avec brackets et récompenses.

#### Types de tournois

| Tournoi | Fréquence | Format | Récompense |
|---------|-----------|--------|------------|
| **Weekly Cup** | Chaque samedi | 8 joueurs, élim. directe | Badge + 50 MMR bonus |
| **Monthly Championship** | Fin de mois | 16 joueurs, double élim. | Badge unique |
| **Season Finals** | Fin de saison | Top 8 du classement | Titre spécial |

#### Flow tournoi

```
1. Inscription ouverte (48h avant)
   - Condition : min 10 parties ranked
   - Max 16 places
   
2. Brackets générés automatiquement
   - Seeding par MMR
   
3. Phases
   - Quarts de finale
   - Demi-finales
   - Finale
   
4. Récompenses distribuées
   - 1er : Badge Or + 100 MMR
   - 2ème : Badge Argent + 50 MMR
   - 3-4ème : Badge Bronze + 25 MMR
```

#### Interface brackets

```
        QUARTS          DEMIS          FINALE
      
     ┌─Hyceman─┐
     │         ├─Hyceman─┐
     └─Player2─┘         │
                         ├─???─── 🏆
     ┌─Player3─┐         │
     │         ├─Player5─┘
     └─Player4─┘
```

### V2 - Système dynamique avancé

Le système utilise une **comparaison paire-à-paire pondérée exponentiellement** :
- Chaque duel contre un adversaire compte
- Le poids dépend de l'écart de MMR (plus proche = plus important)
- Les adversaires très éloignés comptent quasi pas
- **Score proximity** : perdre de peu = moins de pénalité
- **Plancher** : minimum ±1 point par partie

#### Formule de pondération MMR

```javascript
const DECAY = 500; // Ajustable

function getWeight(myMMR, opponentMMR) {
  const diff = Math.abs(myMMR - opponentMMR);
  return Math.exp(-diff / DECAY);
}

// Exemples (DECAY = 500)
getWeight(5000, 4500) // → 0.37 (Rival)
getWeight(5000, 1000) // → 0.0003 (Noob, quasi ignoré)
```

#### Philosophie de la défaite

| Score (sur 150) | Catégorie | Réduction pénalité |
|-----------------|-----------|-------------------|
| **110-149** | Défaite contestée | Réduction progressive (expo) |
| **< 110** | Défaite claire | Aucune réduction |

#### Formule de proximité de score

```javascript
const PROXIMITY_POWER = 2; // Ajustable
const SCORE_THRESHOLD = 110; // En dessous = pleine pénalité

function getScoreProximityFactor(myScore, winnerScore = 150) {
  // En dessous du seuil → pénalité complète
  if (myScore < SCORE_THRESHOLD) {
    return 1.0;
  }
  
  // Au-dessus du seuil → réduction exponentielle
  // Plus proche de 150 = plus de réduction
  const ratio = myScore / winnerScore; // 0.73 à 0.99
  const factor = 1 - Math.pow(ratio, PROXIMITY_POWER) * 0.5;
  
  return Math.max(0.5, factor); // Minimum 50% de réduction
}

// Exemples
getScoreProximityFactor(149) // → 0.51 (perd ~50% moins)
getScoreProximityFactor(140) // → 0.56 (perd ~44% moins)
getScoreProximityFactor(125) // → 0.65 (perd ~35% moins)
getScoreProximityFactor(110) // → 0.73 (perd ~27% moins)
getScoreProximityFactor(109) // → 1.00 (pénalité complète)
getScoreProximityFactor(50)  // → 1.00 (pénalité complète)
```

#### Formule de calcul MMR complète

```javascript
function calculateMMRChange(player, allPlayers) {
  const K = 32; // Facteur K total
  let totalChange = 0;
  let totalWeight = 0;
  
  for (const opponent of allPlayers.filter(p => p !== player)) {
    const weight = getWeight(player.mmr, opponent.mmr);
    totalWeight += weight;
    
    const mmrDiff = player.mmr - opponent.mmr;
    const expectedWin = 1 / (1 + Math.pow(10, -mmrDiff / 400));
    
    const didBeat = player.placement < opponent.placement;
    const actual = didBeat ? 1 : 0;
    
    totalChange += weight * K * (actual - expectedWin);
  }
  
  // Normaliser par le poids total
  let result = totalChange / totalWeight;
  
  // Appliquer le facteur de proximité de score (seulement si perte)
  if (result < 0) {
    const proximityFactor = getScoreProximityFactor(player.score);
    result *= proximityFactor;
  }
  
  result = Math.round(result);
  
  // Plancher : min ±1 point
  if (result === 0) {
    result = player.placement === 1 ? 1 : -1;
  }
  
  return result;
}
```

#### Exemples avec score

```
Partie 1v1 : Hyceman (2000 MMR) vs Rival (2000 MMR)

Scénario A : Hyceman 2ème avec 145 pts
  → Base : -16 pts (match équilibré perdu)
  → Proximité : × 0.54 (expo: 145/150)
  → Final : -9 pts

Scénario B : Hyceman 2ème avec 125 pts
  → Base : -16 pts
  → Proximité : × 0.65 (expo: 125/150)
  → Final : -10 pts

Scénario C : Hyceman 2ème avec 110 pts
  → Base : -16 pts
  → Proximité : × 0.73 (seuil, dernière réduction)
  → Final : -12 pts

Scénario D : Hyceman 2ème avec 109 pts
  → Base : -16 pts
  → Proximité : × 1.00 (< 110 = pas de réduction)
  → Final : -16 pts

Scénario E : Hyceman 1er avec 150 pts
  → Base : +16 pts
  → Pas de modification (gagnant)
  → Final : +16 pts
```

### Exigences techniques
- **Transparence** : Pas de boîte noire, seuils visibles et configurables
- **Tests unitaires** : Batterie de tests sur des scénarios réels
- **Dashboard admin** : Simuler les changements de config sur parties historiques


### 🧪 Fichier de tests MMR (à créer)

Un fichier `mmr-tests.ts` simulera des dizaines de scénarios pour validation manuelle :

#### Scénarios à tester

##### Scénarios de base

| # | Scénario | Joueurs | Résultat attendu |
|---|----------|---------|------------------|
| 1 | Match équilibré 1v1 | 1500 vs 1500 | ~±15 |
| 2 | Favori gagne | 2000 vs 1000 | Faible gain (~3-5) |
| 3 | Upset (faible bat fort) | 1000 bat 2000 | Gros gain (~25-30) |
| 4 | FFA équilibré | 5 joueurs ~1500 | Normal (~±15) |
| 5 | Pro vs noobs | 5000 vs 1000×5 | ~+1 (plancher) |
| 6 | Pro vs 1 rival + noobs | 5000 vs 4500 + 1000×4 | ~±5-6 (rival seul compte) |
| 7 | Très proche | 1500 vs 1490 | ~±16 (proche = poids élevé) |
| 8 | Tous égaux | 1000×6 | Placement-based normal |
| 9 | Abandon (dernier) | - | Pénalité dernier |

##### Scénarios avec score proximity

| # | Scénario | Score | Résultat attendu |
|---|----------|-------|------------------|
| 10 | Perte serrée (1 pt) | 149 vs 150 | -50% de pénalité |
| 11 | Perte normale | 113 vs 150 | -28% de pénalité |
| 12 | Perte lourde | 75 vs 150 | Quasi normal |
| 13 | Écrasement | 20 vs 150 | Pénalité complète |
| 14 | Victoire serrée | 150 vs 149 | Gain normal (pas de bonus) |

##### Edge cases

| # | Scénario | Description | Résultat attendu |
|---|----------|-------------|------------------|
| 15 | 2 joueurs même MMR exact | 1500 vs 1500 | ±16 exactement |
| 16 | 10 joueurs (max) | 10 joueurs, écarts variés | Système ne crash pas |
| 17 | 2 joueurs (min) | 1v1 uniquement | Normal |
| 18 | Score = 0 | Joueur a 0 pts | Pénalité max |
| 19 | MMR très bas | 100 MMR vs 5000 | Poids quasi nul |
| 20 | MMR identique × 6 | Tous à 1500 | Placement seul compte |
| 21 | 1er et 2ème très proches | Hyceman 1er, Rival 2ème, score 150-149 | Faible Δ entre les deux |
| 22 | Milieu de tableau | 3ème sur 6, MMR moyen | Gain/perte modéré |
| 23 | Dernier mais serré | 6ème sur 6, score 140/150 | Pénalité réduite |
| 24 | Nouveau joueur (1000 base) | vs joueurs établis | Évolue rapidement |
| 25 | ~~Égalité de points~~ | IMPOSSIBLE - Popsauce continue jusqu'à départage | N/A |
| 26 | Tous abandonnent sauf 1 | 5 abandons, 1 reste | 1 seul gagne, autres pénalisés |
| 27 | Pro perd contre tous | 5000 MMR finit dernier | Grosse perte mais capped |
| 28 | Noob gagne tout | 1000 MMR finit 1er vs 4000+ | Gain massif |
| 29 | Score négatif (impossible?) | Protection contre valeurs invalides | Erreur gérée |
| 30 | MMR négatif après calcul | Vérifier min 0 MMR | Cap à 0 minimum |


#### Format de sortie

```
┌────────────────────────────────────────────────────────────────┐
│ TEST #6 : Pro vs 1 rival + noobs                               │
├────────────────────────────────────────────────────────────────┤
│ Joueurs :                                                       │
│   • Hyceman: 5000 MMR                                          │
│   • Rival: 4500 MMR                                            │
│   • Noob1-4: 1000 MMR                                          │
│                                                                 │
│ Résultat : Hyceman 1er, Rival 2ème, Noobs 3-6                  │
│                                                                 │
│ Calcul :                                                        │
│   Poids Rival: 0.368                                           │
│   Poids Noobs: 0.0003 × 4 = 0.0012                             │
│   Total weight: 0.369                                          │
│                                                                 │
│ MMR Changes :                                                   │
│   • Hyceman: +5                                                │
│   • Rival: -5                                                  │
│   • Noob1: +2                                                  │
│   • Noob2: +1                                                  │
│   • Noob3: -1                                                  │
│   • Noob4: -2                                                  │
│                                                                 │
│ ✅ PASS / ❌ FAIL (à valider manuellement)                     │
└────────────────────────────────────────────────────────────────┘
```

#### Approche
1. Générer tous les scénarios automatiquement
2. Afficher les résultats de manière lisible
3. Review manuel par Hyceman de chaque cas
4. Ajuster le DECAY si nécessaire

### ⚠️ Limitations connues du système MMR

| Limitation | Description | Impact | Solution potentielle |
|------------|-------------|--------|---------------------|
| **Petite communauté** | Peu de data pour calibration | Variabilité des premiers matchs | Calibration x2 |
| **Catégories séparées** | MMR par catégorie = progression lente | Joueur bon en GP, noob en Anime | Afficher clairement la catégorie |
| **Noobs ignorés** | Poids proche de 0 si écart > 2000 | Peut sembler injuste pour le noob | Plancher minimum ±1 |
| **Non-inscrits** | Non comptabilisés mais peuvent gagner | Fausse impression de scores | Messages explicatifs |
| **Decay inexistant** | Pas de perte MMR si inactif | Joueurs inactifs bloquent le top | Implémenter decay V2 |

### 🔬 Edge cases additionnels à tester

#### Cas limites mathématiques

| # | Scénario | Test |
|---|----------|------|
| 31 | MMR = 0 exactement | Calcul ne divise pas par 0 |
| 32 | MMR = 10000 (très haut) | Pas d'overflow |
| 33 | Tous les poids = 0 | Division par 0 évitée |
| 34 | Score > 150 (bug?) | Gérer gracieusement |
| 35 | Nombre de joueurs = 1 | Match annulé |
| 36 | K-factor = 0 | Aucun changement |

#### Cas de données invalides

| # | Scénario | Comportement attendu |
|---|----------|---------------------|
| 37 | Placement en double | Erreur + log |
| 38 | Joueur absent de la liste | Ignoré |
| 39 | Score = NaN | Erreur + log |
| 40 | MMR = null | Utiliser valeur par défaut 1000 |
| 41 | Partie avec 0 questions | Match invalide |
| 42 | Résultats arrivés 2 fois | Déduplication |

#### Cas de calibration

| # | Scénario | Comportement attendu |
|---|----------|---------------------|
| 43 | 4/5 parties de calibration | Toujours x2 |
| 44 | Exactement 5 parties | Dernière x2, suivante x1 |
| 45 | 6ème partie | x1 normal |
| 46 | Reset de saison pendant calibration | Reprendre la calibration |

#### Cas multi-catégorie

| # | Scénario | Comportement attendu |
|---|----------|---------------------|
| 47 | Première partie en Anime | MMR Anime = 1000, calibration |
| 48 | Pro GP joue en Flags | Flags = 1000, GP intact |
| 49 | Changer de catégorie mid-queue | Impossible, verrouillé |
| 50 | Match avec mauvaise catégorie | Log erreur, match annulé |

---

## 🔌 Déconnexion / Abandon

### Principes
1. **Abandon = Pénalité du dernier**
2. **Vérification uniquement au DÉBUT et à la FIN** (pas pendant)
3. **Joueurs arrivés en cours = IGNORÉS** (protection contre leak du lien)

### Flow de validation

```
DÉBUT DE PARTIE
├── Bot capture la liste des joueurs présents
├── Liste = [Hyceman, User2, User3, User4]
└── Sauvegarde comme "joueurs officiels"

PENDANT LA PARTIE
├── Déconnexions temporaires → OK, ignorées
├── Nouveaux joueurs → Ignorés (pas dans la liste officielle)
└── Pas de vérification

FIN DE PARTIE
├── Bot récupère les résultats
├── Compare avec la liste officielle
├── Joueur absent à la fin = ABANDON → Pénalité dernier
└── Joueur présent mais pas dans liste = NON COMPTABILISÉ
```

### Exemple

```
Liste officielle: [Hyceman, User2, User3, User4]

Résultats fin de partie:
1. Hyceman - 150pts ✅ → +30 MMR
2. User3   - 120pts ✅ → +15 MMR
3. RandomGuy - 80pts ❌ → Ignoré (pas dans liste)
4. User4   - 50pts  ✅ → -15 MMR

User2 absent ❌ → Abandon → -25 MMR (dernier)
```

---

## 🛡️ Anti-triche

### Approche : Simple et communautaire

La communauté étant petite (~100 joueurs), un système complexe n'est pas nécessaire. Les tricheurs seront vite repérés et exclus socialement.

### Mesures

| Mesure | Description |
|--------|-------------|
| **OAuth obligatoire** | Discord ou Twitch requis pour jouer ranked |
| **Auth JKLM** | Réservé aux staffs Popsauce (pas de risque multi-compte) |
| **Signalement manuel** | Les joueurs peuvent signaler un comportement suspect |

### Système de signalement

```
Joueur signale un autre joueur
    ↓
Ticket créé (raison + preuves)
    ↓
Staff PSL examine
    ↓
Décision : Avertissement / Ban temp / Ban permanent
```

### Détection de patterns (anti-farming)

Pas de limite de parties entre mêmes joueurs, mais **détection automatique** des patterns suspects.

#### Patterns détectés

| Pattern | Description | Seuil |
|---------|-------------|-------|
| **Win-trading** | A bat B, puis B bat A, répété | > 5 alternances en 24h |
| **Score suspect** | Matchs toujours très serrés (140-150) | > 70% de matchs serrés entre mêmes joueurs |
| **Farming fréquent** | Mêmes 2 joueurs en boucle | > 10 matchs entre mêmes joueurs en 24h |

#### Actions automatiques

```
Pattern détecté
    ↓
Flag automatique + notification staff
    ↓
Staff examine les parties
    ↓
Si farming confirmé :
  - Annuler les gains MMR
  - Avertissement / Ban temp
```

#### Code de détection

```javascript
async function detectFarming(userId: string) {
  const last24h = await getMatchesLast24h(userId);
  
  // Compter les matchups
  const matchups = countMatchups(last24h); // { opponentId: count }
  
  for (const [opponentId, count] of Object.entries(matchups)) {
    if (count > 10) {
      // Trop de parties
      await flagForReview(userId, opponentId, 'FREQUENT_MATCHUP');
    }
    
    const alternations = countWinAlternations(last24h, opponentId);
    if (alternations > 5) {
      // Win-trading
      await flagForReview(userId, opponentId, 'WIN_TRADING');
    }
    
    const closeMatches = countCloseMatches(last24h, opponentId);
    if (closeMatches / count > 0.7 && count >= 5) {
      // Trop de matchs serrés
      await flagForReview(userId, opponentId, 'SUSPICIOUS_SCORES');
    }
  }
}
```

---

## 🤖 Bot Popsauce

### Deux approches possibles

#### Approche 1 : Browser Automation (Puppeteer/Playwright)
```
Bot = Navigateur complet qui "joue" comme un humain
```
- ❌ Lourd (1 navigateur par partie)
- ❌ RAM intensive (~200-500 MB par instance)
- ❌ Lent à démarrer
- ✅ Fonctionne toujours (simule un vrai utilisateur)

#### Approche 2 : WebSocket Direct 🎯 (préférée)
```
Bot = Connexion directe au serveur JKLM via WebSocket
```
- ✅ Ultra léger (quelques MB)
- ✅ Plusieurs lobbys en simultané sur un seul process
- ✅ Rapide
- ⚠️ Nécessite de reverse-engineer le protocole

### 👀 Gestion des joueurs non-inscrits

Les lobbys Popsauce sont **toujours publics** (pas de mode privé). N'importe qui peut rejoindre.

#### Stratégie : Laisser jouer, ignorer pour MMR

| Type de joueur | Peut jouer | MMR comptabilisé |
|----------------|------------|------------------|
| **Inscrit PSL + vérifié** | ✅ | ✅ |
| **Non-inscrit** | ✅ | ❌ (ignoré) |

#### Messages automatiques du bot

**Quand un non-inscrit rejoint :**
```
🎮 Bienvenue ! Tu n'es pas inscrit sur PSL.
Tu peux jouer mais ton score ne compte pas au classement.
→ Rejoins-nous sur psl.vercel.app !
```

**À la fin de partie :**
```
🏆 Résultats PSL :
1. Hyceman (+12 MMR)
2. Player2 (+5 MMR)

👋 Non-inscrits : RandomGuy, Guest123
Inscrivez-vous pour apparaître au classement !
```

#### Cas du kick

Réservé pour :
- Comportement toxique (signalement)
- Spam join/leave
- Joueur banni de PSL

### 🤖 Bots existants sur Popsauce

Des bots existent déjà sur Popsauce, ce qui confirme que le protocole est exploitable :
- **Identité propre** : le bot a un nom visible
- **Messages de chat** : "Bot a rejoint", "Bot est parti"
- **Peut jouer** : rejoint des parties en cours et répond aux questions

**Pistes d'investigation :**
- Contacter les créateurs de ces bots (partage de code/doc ?)
- Observer un bot existant dans DevTools pour voir les messages WS

### 🔬 Protocole d'investigation WebSocket

#### Étape 1 : Capture du trafic
1. Ouvrir Chrome/Firefox en navigation privée
2. Aller sur https://jklm.fun
3. F12 → Onglet **Network** → Filtrer par **WS** (WebSocket)
4. Créer un lobby Popsauce
5. Observer les messages échangés

#### Étape 2 : Documenter les messages
Capturer et documenter :

| Action | Message envoyé | Message reçu |
|--------|---------------|--------------|
| Créer lobby | ? | ? |
| Rejoindre lobby | ? | ? |
| Configurer partie | ? | ? |
| Lancer partie | ? | ? |
| Question apparaît | - | ? |
| Joueur répond | ? | ? |
| Fin de partie | - | ? |
| Résultats | - | ? |

#### Étape 3 : Identifier le protocole
- Format des messages (JSON ? binaire ?)
- Authentification requise ?
- Tokens/sessions ?
- Heartbeat/ping ?

#### Étape 4 : POC WebSocket
```javascript
// test-ws-connection.js
const WebSocket = require('ws');

const ws = new WebSocket('wss://jklm.fun/socket'); // URL à déterminer

ws.on('open', () => {
  console.log('Connecté !');
  // Envoyer message de création de lobby
});

ws.on('message', (data) => {
  console.log('Reçu:', data);
});
```

#### Étape 5 : Valider
- [ ] Peut-on créer un lobby via WS ?
- [ ] Peut-on recevoir les résultats ?
- [ ] Peut-on gérer plusieurs lobbys ?

### Workflow technique (si WebSocket fonctionne)
```
1. Bot ouvre connexion WebSocket vers JKLM
2. Envoie message "créer lobby Popsauce"
3. Reçoit l'ID du lobby
4. Partage le lien aux joueurs via PSL
5. Écoute les événements (joueurs rejoignent, partie démarre)
6. À la fin, reçoit les résultats via WS
7. Envoie les données au backend PSL
```

### Fallback
Si WebSocket ne fonctionne pas → utiliser Playwright en fallback.

---

### 🏛️ Architecture du Bot

```
┌─────────────────────────────────────────────────────────────┐
│                      BOT PSL SERVICE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐     ┌─────────────────┐               │
│  │  WebSocket      │     │  API Client     │               │
│  │  Manager        │     │  (vers PSL)     │               │
│  │                 │     │                 │               │
│  │  - Connexion    │     │  - Auth         │               │
│  │  - Ping/Pong    │     │  - Send results │               │
│  │  - Reconnect    │     │  - Get queue    │               │
│  └────────┬────────┘     └────────┬────────┘               │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │                  LOBBY MANAGER                      │    │
│  │                                                     │    │
│  │  - Create lobby       - Track players               │    │
│  │  - Configure game     - Monitor game state          │    │
│  │  - Start game         - Collect results             │    │
│  └────────────────────────────────────────────────────┘    │
│                            │                                │
│           ┌────────────────┼────────────────┐              │
│           ▼                ▼                ▼              │
│     ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│     │ Lobby 1  │    │ Lobby 2  │    │ Lobby N  │          │
│     │ (active) │    │ (active) │    │ (idle)   │          │
│     └──────────┘    └──────────┘    └──────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 📋 Commandes attendues

| Commande | Direction | Description |
|----------|-----------|-------------|
| `createLobby()` | Bot → JKLM | Créer un nouveau lobby Popsauce |
| `configureLobby(config)` | Bot → JKLM | Configurer (150 pts, FR, etc.) |
| `startGame()` | Bot → JKLM | Lancer la partie |
| `getPlayers()` | Bot ← JKLM | Liste des joueurs présents |
| `onPlayerJoin(player)` | Bot ← JKLM | Callback: joueur rejoint |
| `onPlayerLeave(player)` | Bot ← JKLM | Callback: joueur part |
| `onGameStart()` | Bot ← JKLM | Callback: partie démarre |
| `onGameEnd(results)` | Bot ← JKLM | Callback: partie terminée avec résultats |
| `onQuestion(question)` | Bot ← JKLM | Callback: nouvelle question (optionnel) |

### 🔄 Machine d'état du Lobby

```
                      ┌─────────────┐
                      │    IDLE     │
                      └──────┬──────┘
                             │ createLobby()
                             ▼
                      ┌─────────────┐
                      │   CREATED   │
                      └──────┬──────┘
                             │ players join
                             ▼
                      ┌─────────────┐
              ┌──────▶│   WAITING   │◀──────┐
              │       └──────┬──────┘       │
              │              │ startGame()  │
              │              ▼              │
              │       ┌─────────────┐       │
              │       │  IN_GAME    │       │
              │       └──────┬──────┘       │
              │              │ game ends    │
              │              ▼              │
              │       ┌─────────────┐       │
              └───────│  FINISHED   │───────┘
                      └──────┬──────┘ (replay?)
                             │ close
                             ▼
                      ┌─────────────┐
                      │   CLOSED    │
                      └─────────────┘
```

### 🛡️ Gestion des erreurs

| Erreur | Cause | Action |
|--------|-------|--------|
| **WS_DISCONNECTED** | Connexion perdue | Reconnexion auto (3 essais) |
| **LOBBY_CREATION_FAILED** | JKLM surchargé | Retry après 5s |
| **PLAYER_NOT_FOUND** | Joueur PSL absent du lobby | Marquer comme abandon |
| **GAME_TIMEOUT** | Partie dure > 30min | Annuler et notifier |
| **INVALID_RESULTS** | Résultats incohérents | Log + investigation manuelle |

```javascript
class BotError extends Error {
  constructor(code, message, context) {
    super(message);
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();
  }
}

// Retry logic
async function withRetry(fn, maxRetries = 3, delayMs = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await sleep(delayMs);
    }
  }
}
```

### 📊 Données collectées par le Bot

```typescript
interface GameResult {
  lobbyCode: string;
  startedAt: Date;
  endedAt: Date;
  players: PlayerResult[];
}

interface PlayerResult {
  popsauceId: string;      // ID dans Popsauce (ex: "Hyceman on Discord")
  placement: number;        // 1er, 2ème, etc.
  score: number;           // Points finaux (ex: 150)
  isWinner: boolean;
  wasPresent: boolean;     // Présent au début ET à la fin
}
```

### 🔧 Configuration du Bot

```javascript
const BOT_CONFIG = {
  // Connexion
  JKLM_WS_URL: 'wss://jklm.fun/socket', // À déterminer
  RECONNECT_DELAY_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 3,
  
  // Lobby
  DEFAULT_POINTS_LIMIT: 150,
  DEFAULT_LANGUAGE: 'fr',
  MAX_PLAYERS: 10,
  MIN_PLAYERS: 2,
  
  // Timeouts
  LOBBY_CREATION_TIMEOUT_MS: 10000,
  GAME_START_TIMEOUT_MS: 120000, // 2 min pour que les joueurs rejoignent
  GAME_MAX_DURATION_MS: 1800000, // 30 min max
  
  // PSL API
  PSL_API_URL: 'https://psl.vercel.app/api',
  PSL_BOT_TOKEN: process.env.PSL_BOT_TOKEN,
};
```

### 🚀 Commandes de démarrage

```bash
# Développement
npm run bot:dev

# Production
npm run bot:start

# Avec PM2 (recommandé)
pm2 start bot.js --name psl-bot

# Logs
pm2 logs psl-bot
```

### 🧪 Tests Edge Cases du Bot

#### Scénarios de connexion

| # | Scénario | Comportement attendu |
|---|----------|---------------------|
| 1 | WS déconnecté pendant création lobby | Retry 3x puis échec gracieux |
| 2 | WS déconnecté pendant partie | Marquer partie comme invalide |
| 3 | JKLM en maintenance | Détecter erreur, notifier admin |
| 4 | Timeout connexion WS | Retry avec backoff exponentiel |
| 5 | Message WS malformé | Log erreur, ignorer message |

#### Scénarios de lobby

| # | Scénario | Comportement attendu |
|---|----------|---------------------|
| 6 | 0 joueurs rejoignent après 2min | Annuler lobby, libérer ressources |
| 7 | 1 seul joueur rejoint | Attendre ou annuler (configurable) |
| 8 | 11 joueurs veulent rejoindre (>max) | Rejeter le 11ème |
| 9 | Joueur rejoint puis part immédiatement | Ne pas compter dans liste initiale |
| 10 | Joueur spam join/leave | Rate limiting, ignorer après X fois |
| 11 | Lobby créé mais lien non partagé | Timeout, cleanup auto |

#### Scénarios de partie

| # | Scénario | Comportement attendu |
|---|----------|---------------------|
| 12 | Partie dure > 30min | Force end, résultats partiels |
| 13 | Tous les joueurs quittent | Annuler partie |
| 14 | Gagnant quitte juste avant fin | 2ème devient gagnant |
| 15 | Joueur non-PSL répond | Ignorer dans les résultats |
| 16 | 2 joueurs PSL, 5 non-PSL | Calculer MMR que pour les 2 PSL |
| 17 | Score = 0 pour un joueur | Traiter comme destruction |
| 18 | Déconnexion pendant dernière question | Attendre 30s, puis finaliser |

#### Scénarios de résultats

| # | Scénario | Comportement attendu |
|---|----------|---------------------|
| 19 | Résultats incomplets | Log warning, demander vérif manuelle |
| 20 | Joueur présent au début, absent à la fin | Marquer comme abandon |
| 21 | Joueur absent au début, présent à la fin | Ignorer (arrivé en cours) |
| 22 | Doublon de pseudo | Erreur, ne pas enregistrer |
| 23 | API PSL down | Queue résultats, retry plus tard |
| 24 | Résultats envoyés 2x (dupe) | Détecter et ignorer 2ème envoi |

#### Scénarios de sécurité

| # | Scénario | Comportement attendu |
|---|----------|---------------------|
| 25 | Quelqu'un usurpe le pseudo du bot | Vérifier token/session |
| 26 | Faux messages WS injectés | Valider origine des messages |
| 27 | Tentative de crash via payload | Sanitize toutes les entrées |
| 28 | Flood de créations de lobby | Rate limit par IP/session |

#### Tests automatisés

```javascript
describe('Bot Edge Cases', () => {
  describe('Connection', () => {
    test('should reconnect on WS disconnect', async () => {
      const bot = new PslBot();
      await bot.connect();
      bot.disconnect(); // Simulate disconnect
      await wait(6000);
      expect(bot.isConnected).toBe(true);
    });
    
    test('should give up after 3 retries', async () => {
      mockWsFailure();
      const bot = new PslBot();
      await expect(bot.connect()).rejects.toThrow('MAX_RETRIES');
    });
  });
  
  describe('Lobby', () => {
    test('should timeout if no players join', async () => {
      const lobby = await bot.createLobby();
      await wait(121000); // 2min + 1s
      expect(lobby.state).toBe('CANCELLED');
    });
    
    test('should reject player 11', async () => {
      const lobby = await bot.createLobby();
      for (let i = 0; i < 10; i++) {
        await lobby.addPlayer(`player${i}`);
      }
      await expect(lobby.addPlayer('player10')).rejects.toThrow('MAX_PLAYERS');
    });
  });
  
  describe('Results', () => {
    test('should mark missing player as abandoned', async () => {
      const result = processResults({
        initialPlayers: ['A', 'B', 'C'],
        finalPlayers: ['A', 'B'], // C missing
        scores: { A: 150, B: 120 }
      });
      expect(result.players.find(p => p.id === 'C').isAbandoned).toBe(true);
    });
  });
});
```

---

## 🏗️ Stack technique

### Stack retenue : Next.js + Moderne

| Layer | Technologie | Raison |
|-------|-------------|--------|
| **Frontend** | Next.js 14 (App Router) | SSR, routing, API intégrés |
| **Styling** | Tailwind CSS | Rapide, utilitaire, responsive |
| **UI Components** | shadcn/ui | Composants accessibles, customisables |
| **Backend** | Next.js API Routes | Tout en un, serverless-ready |
| **BDD** | PostgreSQL + Prisma | Relations fortes, type-safe |
| **Temps réel** | Socket.io | Matchmaking, notifications |
| **Auth** | NextAuth.js v5 | Discord/Twitch OAuth intégré |
| **i18n** | next-intl | Traductions FR/EN, routing localisé |
| **Testing** | Vitest + Testing Library | Tests unitaires, rapides, TypeScript |
| **Bot** | Node.js + WebSocket (ou Playwright) | Léger si WS, robuste si Playwright |

### 🧪 Stratégie de tests

Tests unitaires pour assurer la robustesse de l'application.

#### Outils

| Outil | Usage |
|-------|-------|
| **Vitest** | Test runner, compatible TypeScript |
| **Testing Library** | Tests composants React |
| **MSW** | Mock des API |
| **Prisma** | Test DB avec sqlite en mémoire |

#### Couverture par fonctionnalité

| Fonctionnalité | Tests requis | Priorité |
|----------------|--------------|----------|
| **Calcul MMR** | Unitaire (tous les edge cases) | 🔴 Critique |
| **Proximity factor** | Unitaire (seuils, formule) | 🔴 Critique |
| **Calibration** | Unitaire (multiplicateur, limite) | 🔴 Critique |
| **Rang calculation** | Unitaire (seuils, Grand Maître) | 🟡 Haute |
| **Détection farming** | Unitaire (patterns) | 🟡 Haute |
| **Matchmaking queue** | Intégration (Socket.io) | 🟡 Haute |
| **Auth flow** | Intégration (OAuth mock) | 🟡 Haute |
| **Bot commands** | Unitaire (messages WS) | 🟡 Haute |
| **Achievements** | Unitaire (conditions) | 🟢 Moyenne |
| **Leaderboard** | Intégration (queries) | 🟢 Moyenne |

#### Structure des tests

```
/src
  /lib
    /mmr
      mmr.ts
      mmr.test.ts        ← Tests unitaires MMR
    /matchmaking
      queue.ts
      queue.test.ts      ← Tests queue
  /components
    PlayerCard.tsx
    PlayerCard.test.tsx  ← Tests composants
```

#### Exemples de tests MMR

```typescript
// mmr.test.ts
import { describe, test, expect } from 'vitest';
import { calculateMMRChange, getScoreProximityFactor, getRank } from './mmr';

describe('Score Proximity Factor', () => {
  test('should return 1.0 for score < 110', () => {
    expect(getScoreProximityFactor(109)).toBe(1.0);
    expect(getScoreProximityFactor(50)).toBe(1.0);
  });
  
  test('should reduce penalty for score >= 110', () => {
    expect(getScoreProximityFactor(149)).toBeLessThan(1.0);
    expect(getScoreProximityFactor(110)).toBeLessThan(1.0);
  });
  
  test('should give max reduction at 149', () => {
    expect(getScoreProximityFactor(149)).toBeCloseTo(0.51, 1);
  });
});

describe('Rank Calculation', () => {
  test('should return correct rank for MMR', () => {
    expect(getRank(500, 100)).toBe('BRONZE');
    expect(getRank(1500, 50)).toBe('OR');
    expect(getRank(2200, 10)).toBe('MASTER');
  });
  
  test('should return GRAND_MASTER for top 5', () => {
    expect(getRank(1000, 1)).toBe('GRAND_MASTER');
    expect(getRank(1000, 5)).toBe('GRAND_MASTER');
    expect(getRank(1000, 6)).toBe('SILVER');
  });
});
```

#### CI/CD

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test -- --coverage
```

#### Commandes

```bash
# Tous les tests
npm test

# Avec coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Un fichier spécifique
npm test mmr.test.ts
```

### Internationalisation (i18n)

Support multilingue prévu dès le départ.

#### Langues supportées

| Langue | Code | Statut |
|--------|------|--------|
| Français | `fr` | ✅ Par défaut |
| Anglais | `en` | 📅 V2 |

#### Structure des traductions

```
/messages
  /fr.json    → Traductions françaises
  /en.json    → Traductions anglaises
```

#### Exemple de fichier

```json
// fr.json
{
  "nav.dashboard": "Tableau de bord",
  "nav.leaderboard": "Classement",
  "queue.searching": "Recherche en cours...",
  "queue.players": "{count} joueurs en attente",
  "rank.bronze": "Bronze",
  "rank.grandmaster": "Grand Maître"
}
```

#### Librairie : next-intl

```javascript
import { useTranslations } from 'next-intl';

function QueuePage() {
  const t = useTranslations('queue');
  
  return (
    <div>
      <h1>{t('searching')}</h1>
      <p>{t('players', { count: 3 })}</p>
    </div>
  );
}
```

### Alternatives CSS considérées

| Librairie | Avantages | Inconvénients |
|-----------|-----------|---------------|
| **Tailwind CSS** ✅ | Ultra populaire, utilitaire, rapide | Classes longues |
| **shadcn/ui** ✅ | Composants prêts, Tailwind-based | Setup initial |
| **Chakra UI** | Composants accessibles | Plus lourd |
| **Mantine** | Complet, hooks inclus | Moins flexible |
| **Styled Components** | CSS-in-JS, scoped | Runtime overhead |

**Choix final** : Tailwind CSS + shadcn/ui (meilleur combo rapidité/qualité)

### Architecture déploiement

```
┌─────────────────────────────────────────────────┐
│  VERCEL (gratuit)                               │
│  ┌───────────────────────────────────────────┐  │
│  │  Next.js App                              │  │
│  │  - Pages frontend                         │  │
│  │  - API Routes                             │  │
│  │  - NextAuth                               │  │
│  │  - Socket.io (via Vercel Edge?)           │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│  SUPABASE / NEON (gratuit tier)                 │
│  PostgreSQL + Prisma                            │
└─────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│  VPS OVH/Hetzner (~5€/mois)                     │
│  ┌───────────────────────────────────────────┐  │
│  │  Bot Service                              │  │
│  │  - WebSocket client vers JKLM             │  │
│  │  - Ou Playwright si nécessaire            │  │
│  │  - Communique avec API Next.js            │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Coût estimé

**Si bot WebSocket (léger) :**
- Vercel : **0€** (gratuit hobby)
- Supabase/Neon : **0€** (gratuit tier)
- Bot sur Railway/Fly.io : **0€** (gratuit tier)
- **Total : 0€** ✨

**Si bot Playwright (fallback) :**
- Bot sur VPS Hetzner : **~5€/mois**
- **Total : ~5€/mois**

---

## 📊 Modèle de données

### Schéma relationnel

```
User ──< MatchPlayer >── Match
  │           │
  │           ▼
  └────> MMRHistory
  │
  └────> Report (reporter/reported)
```

### Schema Prisma

```prisma
model User {
  id           String   @id @default(cuid())
  discordId    String?  @unique
  twitchId     String?  @unique
  jklmUsername String?  @unique
  displayName  String
  mmr          Int      @default(1000)
  createdAt    DateTime @default(now())
  isBanned     Boolean  @default(false)
  
  matchPlayers   MatchPlayer[]
  mmrHistory     MMRHistory[]
  reportsMade    Report[] @relation("Reporter")
  reportsAgainst Report[] @relation("Reported")
}

model Match {
  id        String      @id @default(cuid())
  lobbyCode String
  status    MatchStatus @default(PENDING)
  createdAt DateTime    @default(now())
  startedAt DateTime?
  endedAt   DateTime?
  
  players   MatchPlayer[]
}

enum MatchStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model MatchPlayer {
  id          String   @id @default(cuid())
  matchId     String
  userId      String
  placement   Int?
  points      Int?
  mmrBefore   Int
  mmrAfter    Int?
  isAbandoned Boolean  @default(false)
  
  match       Match    @relation(fields: [matchId], references: [id])
  user        User     @relation(fields: [userId], references: [id])
  
  @@unique([matchId, userId])
}

model MMRHistory {
  id        String   @id @default(cuid())
  userId    String
  matchId   String?
  change    Int
  reason    String
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
}

model Report {
  id         String       @id @default(cuid())
  reporterId String
  reportedId String
  reason     String
  evidence   String?
  status     ReportStatus @default(PENDING)
  createdAt  DateTime     @default(now())
  
  reporter   User @relation("Reporter", fields: [reporterId], references: [id])
  reported   User @relation("Reported", fields: [reportedId], references: [id])
}

enum ReportStatus {
  PENDING
  REVIEWED
  RESOLVED
  DISMISSED
}
```

### Données étendues (analytics)

Pour collecter les temps de réponse par question (futur) :

```prisma
// Question posée dans une partie
model MatchQuestion {
  id           String   @id @default(cuid())
  matchId      String
  questionNum  Int      // 1, 2, 3...
  
  // Identification de la question (pour retrouver les doublons)
  questionText String?  // Intitulé de la question
  imageUrl     String?  // URL de l'image (si question image)
  imageHash    String?  // Hash de l'image pour déduplication
  correctAnswer String? // La bonne réponse
  
  match        Match    @relation(fields: [matchId], references: [id])
  responses    QuestionResponse[]
  
  @@unique([matchId, questionNum])
  @@index([imageHash])  // Pour retrouver les questions similaires
}

// Réponse d'un joueur à une question
model QuestionResponse {
  id              String   @id @default(cuid())
  matchQuestionId String
  userId          String
  answerTyped     String   // Ce que le joueur a tapé
  responseTimeMs  Int      // Temps en ms jusqu'à réponse validée
  wasCorrect      Boolean
  placement       Int      // 1er, 2ème à répondre...
  pointsEarned    Int      // 10, 9, 8... ou 0
  
  matchQuestion   MatchQuestion @relation(fields: [matchQuestionId], references: [id])
  user            User          @relation(fields: [userId], references: [id])
  
  @@unique([matchQuestionId, userId])
}
```

### Utilisation future des données

| Donnée | Usage potentiel |
|--------|-----------------|
| `questionText` + `imageHash` | Identifier les questions récurrentes |
| `answerTyped` | Analyser les erreurs de frappe, triggers |
| `responseTimeMs` par question | Stats de vitesse, identifier questions difficiles |
| `correctAnswer` | Construire une base de questions connues |

> **Note** : Ces tables sont optionnelles pour le MVP. À activer quand on veut des stats avancées.

---

## 🎨 UI / Design

### Pages MVP

| Page | Fonction |
|------|----------|
| **Landing** | Présentation PSL + CTA "Rejoindre" |
| **Login** | OAuth Discord/Twitch |
| **Dashboard** | MMR perso, stats, bouton "Jouer" |
| **Matchmaking** | Queue en temps réel, joueurs en attente |
| **Classement** | Leaderboard global |
| **Profil joueur** | Stats détaillées, historique, graph MMR |

### Direction artistique

- **Thème** : Sombre (gaming/esport)
- **Couleurs** : Violet (#8B5CF6), Cyan (#22D3EE), fond sombre (#0F0F1A)
- **Police** : Inter ou Outfit
- **Animations** : Transitions fluides, micro-interactions
- **Bordures** : Glow néon subtil sur les éléments interactifs

---

### 📐 Wireframes

#### Landing Page

```
┌─────────────────────────────────────────────────────────────────┐
│  🎮 PSL                              [Connexion] [S'inscrire]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│              ╔═══════════════════════════════════╗              │
│              ║                                   ║              │
│              ║     🏆 POPSAUCE LEAGUE 🏆        ║              │
│              ║                                   ║              │
│              ║   Le ranked compétitif pour      ║              │
│              ║        Popsauce français         ║              │
│              ║                                   ║              │
│              ║   [  🎮 REJOINDRE LA LIGUE  ]    ║              │
│              ║                                   ║              │
│              ╚═══════════════════════════════════╝              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 🎯 MMR     │  │ 📊 Stats   │  │ 🏆 Saisons  │             │
│  │ Système Elo│  │ Détaillées │  │ Mensuelles  │             │
│  │ compétitif │  │ par joueur │  │ + badges    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ───────────────── TOP 5 ACTUELS ─────────────────             │
│  🥇 Hyceman (2450 MMR)                                         │
│  🥈 Player2 (2320 MMR)                                         │
│  🥉 Player3 (2180 MMR)                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Dashboard (après login)

```
┌─────────────────────────────────────────────────────────────────┐
│  🎮 PSL     [Dashboard] [Classement] [Profil]      👤 Hyceman  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────┐  ┌────────────────────────────┐ │
│  │  🏆 TON MMR               │  │  📊 CETTE SAISON           │ │
│  │                           │  │                            │ │
│  │  ████████████████  2450   │  │  Parties: 47               │ │
│  │                           │  │  Victoires: 38 (81%)       │ │
│  │  Rang: #1 🥇              │  │  Meilleur MMR: 2520        │ │
│  │  Top 0.1%                 │  │  Streak actuel: 5 W        │ │
│  └────────────────────────────┘  └────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │    ╔════════════════════════════════════════════╗       │  │
│  │    ║                                            ║       │  │
│  │    ║      [   🎮 CHERCHER UNE PARTIE   ]       ║       │  │
│  │    ║                                            ║       │  │
│  │    ╚════════════════════════════════════════════╝       │  │
│  │                                                          │  │
│  │    3 joueurs en ligne • 1 en recherche                  │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ─────────────── DERNIÈRES PARTIES ───────────────             │
│  │ Il y a 2h  │ 1er/5  │ +12 MMR │ [Détails]              │   │
│  │ Il y a 5h  │ 2ème/6 │ +3 MMR  │ [Détails]              │   │
│  │ Hier       │ 1er/4  │ +8 MMR  │ [Détails]              │   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Matchmaking (en recherche)

```
┌─────────────────────────────────────────────────────────────────┐
│  🎮 PSL     [Dashboard] [Classement] [Profil]      👤 Hyceman  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│              ╔═══════════════════════════════════╗              │
│              ║                                   ║              │
│              ║      🔍 RECHERCHE EN COURS       ║              │
│              ║                                   ║              │
│              ║      ⏱️ 00:47                    ║              │
│              ║                                   ║              │
│              ║   3 / 6 joueurs minimum          ║              │
│              ║   ████████████░░░░ 50%           ║              │
│              ║                                   ║              │
│              ╚═══════════════════════════════════╝              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  JOUEURS EN ATTENTE                                    │    │
│  │                                                        │    │
│  │  🟢 Hyceman         2450 MMR   🥇                     │    │
│  │  🟢 Player2         1820 MMR                          │    │
│  │  🟢 Player3         1650 MMR                          │    │
│  │  ⏳ En attente d'autres joueurs...                    │    │
│  │                                                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│              [  ❌ ANNULER LA RECHERCHE  ]                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Match trouvé (popup)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│         ╔═══════════════════════════════════════════╗           │
│         ║                                           ║           │
│         ║      ✅ PARTIE TROUVÉE !                 ║           │
│         ║                                           ║           │
│         ║   6 joueurs • Lobby créé                 ║           │
│         ║                                           ║           │
│         ║   Hyceman (2450) • Player2 (1820)        ║           │
│         ║   Player3 (1650) • Player4 (1580)        ║           │
│         ║   Player5 (1420) • Player6 (1350)        ║           │
│         ║                                           ║           │
│         ║   ┌─────────────────────────────────┐    ║           │
│         ║   │  🎮 REJOINDRE SUR POPSAUCE     │    ║           │
│         ║   │     jklm.fun/ABCD              │    ║           │
│         ║   └─────────────────────────────────┘    ║           │
│         ║                                           ║           │
│         ║   ⏱️ La partie commence dans 30s        ║           │
│         ║                                           ║           │
│         ╚═══════════════════════════════════════════╝           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Classement (Leaderboard)

```
┌─────────────────────────────────────────────────────────────────┐
│  🎮 PSL     [Dashboard] [Classement] [Profil]      👤 Hyceman  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🏆 CLASSEMENT SAISON DÉCEMBRE 2024                            │
│                                                                  │
│  [Cette saison ▼]    [Tous]    [Top 10]    [Autour de moi]     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ #   Joueur            MMR     W/L      Winrate   Trend   │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 🥇  Hyceman          2450    38/9      81%       ↗️ +45  │  │
│  │ 🥈  Player2          2320    35/12     74%       ↗️ +23  │  │
│  │ 🥉  Player3          2180    30/15     67%       ↘️ -12  │  │
│  │ 4   Player4          2050    28/18     61%       →  +2   │  │
│  │ 5   Player5          1980    25/20     56%       ↗️ +18  │  │
│  │ 6   Player6          1920    24/22     52%       ↘️ -8   │  │
│  │ 7   Player7          1850    22/24     48%       →  0    │  │
│  │ ... │                                                     │  │
│  │ 42  Toi es ici!      ---     --/--     --%       ---     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  📊 Distribution MMR                                            │
│  < 1000 ████░░░░░░ 10%                                         │
│  1000-1500 ████████░░ 35%                                      │
│  1500-2000 ██████░░░░ 40%                                      │
│  > 2000 ██░░░░░░░░ 15%                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Profil joueur

```
┌─────────────────────────────────────────────────────────────────┐
│  🎮 PSL     [Dashboard] [Classement] [Profil]      👤 Hyceman  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  👤 HYCEMAN                                            │    │
│  │                                                        │    │
│  │  🔗 Discord: Hyceman#1234                             │    │
│  │  📅 Membre depuis: Nov 2024                           │    │
│  │                                                        │    │
│  │  🏆 Badges:                                           │    │
│  │  [Champion Nov 🥇] [Élite Dec 🥈] [Master Jan 🥉]    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ 📊 STATS GLOBALES  │  │ 📈 ÉVOLUTION MMR   │              │
│  │                     │  │                     │              │
│  │ MMR actuel: 2450   │  │  2500 ─┐            │              │
│  │ MMR max: 2520      │  │        │    ╱╲      │              │
│  │ Parties: 156       │  │  2000 ─┤   ╱  ╲╱╲   │              │
│  │ Victoires: 112     │  │        │  ╱        │              │
│  │ Winrate: 72%       │  │  1500 ─┤╱          │              │
│  │ Streak max: 12W    │  │        └───────────│              │
│  └─────────────────────┘  │  Nov  Dec  Jan    │              │
│                            └─────────────────────┘              │
│                                                                  │
│  ─────────────── HISTORIQUE DES PARTIES ───────────────        │
│  │ 19/12 14:32 │ 1er/5 │ +12 │ vs Player2, Player3...    │    │
│  │ 19/12 13:15 │ 2ème/6│ +3  │ vs Player4, Player5...    │    │
│  │ 18/12 21:45 │ 1er/4 │ +8  │ vs Player6, Player7...    │    │
│  │ [Voir plus...]                                         │    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Outils suggérés

| Outil | Usage |
|-------|-------|
| **Figma** | Maquettes détaillées |
| **V0.dev** | Prototype code shadcn/ui |
| **Excalidraw** | Wireframes rapides |

---

## 🎭 Communauté

### Serveur Discord PSL

| Channel | Usage |
|---------|-------|
| `#annonces` | Updates PSL, maintenance |
| `#règles` | Règlement, anti-triche |
| `#lobby-recherche` | Notifications de matchmaking |
| `#classement` | Leaderboard auto-updated |
| `#signalements` | Reports (staff only) |
| `#général` | Discussion libre |

### Bot Discord (V2)

| Commande | Action |
|----------|--------|
| `/link` | Lier son compte PSL à Discord |
| `/stats @user` | Afficher les stats d'un joueur |
| `/leaderboard` | Top 10 actuel |
| `/queue` | Voir qui est en recherche |

### Notifications automatiques

```
🎮 2 joueurs en recherche !
→ Rejoins sur psl.vercel.app

🏆 Partie terminée
1. Hyceman (+30 MMR)
2. User2 (+15 MMR)
```

### Intégration web ↔ Discord

- **OAuth Discord** pour login
- **Webhook** pour poster les résultats
- **Bot complet** en V2

### Domaine

- MVP : `psl.vercel.app` (gratuit)
- Future : `psl.gg` (~60€/an)

---

## 🏆 Saisons

### Format

- **Durée** : 1 mois (du 1er au dernier jour)
- **Reset** : Soft reset automatique le 1er de chaque mois

### Soft Reset

```
Nouveau MMR = (Ancien MMR + 1000) / 2

Exemples :
- 2000 MMR → 1500
- 1000 MMR → 1000
- 500 MMR  → 750
```

### Rewards

| Rang fin de saison | Reward |
|--------------------|--------|
| 🥇 Top 1 | Badge "Champion" + Titre |
| 🥈 Top 3 | Badge "Élite" |
| 🥉 Top 10 | Badge "Master" |
| Top 50% | Badge "Compétiteur" |

Chaque mois a un badge au design/couleur unique. Les badges sont cumulatifs et visibles sur le profil.

### Automatisation

- Reset MMR automatique
- Récap saison posté sur Discord
- Attribution des badges automatique

---

## 📋 Roadmap

### Phase 0 : Investigation Bot (1-2 jours)

| Tâche | Détail | Priorité |
|-------|--------|----------|
| Capturer trafic WS | Chrome DevTools, Wireshark si nécessaire | 🔴 Critique |
| Documenter protocole | Format messages, auth, events | 🔴 Critique |
| POC connexion WS | Script Node.js simple | 🔴 Critique |
| Valider viabilité | Créer lobby via WS ? | 🔴 Critique |

**Critère de succès** : Pouvoir créer un lobby Popsauce via WebSocket (ou décision Playwright)

---

### Phase 1 : POC (2-3 jours)

| Tâche | Détail | Priorité |
|-------|--------|----------|
| Script création partie | WS ou Playwright | 🔴 Critique |
| Script récupération résultats | Scores, placements | 🔴 Critique |
| Test multi-lobbys | Gérer 2+ lobbys simultanés | 🟡 Important |

**Critère de succès** : Créer partie → jouer manuellement → récupérer résultats automatiquement

---

### Phase 2 : MVP (2-4 semaines)

#### Semaine 1-2 : Infrastructure

| Tâche | Détail |
|-------|--------|
| Setup Next.js | App Router, TypeScript |
| Setup BDD | PostgreSQL + Prisma |
| Auth Discord | NextAuth.js v5 |
| Modèle de données | User, Match, MatchPlayer |

#### Semaine 3 : Core features

| Tâche | Détail |
|-------|--------|
| Page matchmaking | Queue, timer, Socket.io |
| Intégration bot | Connexion web ↔ bot |
| MMR V1 | Système hybride simple |
| Page profil | Stats basiques |

#### Semaine 4 : Polish

| Tâche | Détail |
|-------|--------|
| Page classement | Top 100, MMR, rang |
| Notifications | Discord webhook |
| UI/UX polish | Responsive, dark mode |
| Tests | Scénarios MMR, edge cases |

**Critère de succès** : 100 joueurs peuvent s'inscrire, jouer, voir leur MMR évoluer

---

### Phase 3 : V2 (2-4 semaines après MVP)

| Feature | Priorité |
|---------|----------|
| MMR V2 (pairwise) | 🔴 Haute |
| Calibration | 🔴 Haute |
| Achievements | 🟡 Moyenne |
| Tournois auto | 🟡 Moyenne |
| Stats avancées | 🟡 Moyenne |
| Mode spectateur | 🟢 Basse |
| Internationalisation | 🟢 Basse |

---

### Phase 4 : V3 (futur lointain)

- App mobile (PWA ou React Native)
- API publique
- Bot Discord complet
- Ligues/Équipes
- Intégration streaming

---

### Timeline estimée

```
Semaine 1    ████░░░░░░░░░░░░  Phase 0-1 (Bot)
Semaine 2-3  ░░░░████████░░░░  Phase 2a (Infra)
Semaine 4-5  ░░░░░░░░████████  Phase 2b (Features)
Semaine 6+   ░░░░░░░░░░░░████  Phase 3 (V2)
```

---

## 📝 Notes

*Ce document sera mis à jour au fil du brainstorming.*


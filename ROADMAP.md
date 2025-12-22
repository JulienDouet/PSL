# PSL Roadmap - Features Manquantes

Analyse comparative entre le fichier PSL_BRAINSTORM.md et l'implémentation actuelle.

---

## 🔴 Non Implémenté (Haute Priorité)

### 1. Système d'Achievements
**Brainstorm :** Badges débloqués par accomplissements

| Achievement | Condition | Status |
|-------------|-----------|--------|
| Première victoire | Gagner 1 partie | ❌ Non implémenté |
| Vétéran | 100 parties jouées | ❌ Non implémenté |
| Centurion | 100 victoires | ❌ Non implémenté |
| Imbattable | 10 victoires d'affilée | ❌ Non implémenté |
| Comeback | Gagner à 149-150 | ❌ Non implémenté |
| Giant Slayer | Battre un Grand Maître | ❌ Non implémenté |

**État actuel :** Le schéma Prisma contient les tables `Achievement` et `UserAchievement` mais aucune logique d'attribution n'existe.

---

### 2. Système de Saisons
**Brainstorm :** Durée 1 mois, soft reset, badges par saison

| Feature | Status |
|---------|--------|
| Définition des saisons (dates début/fin) | ❌ Non implémenté |
| Soft reset MMR automatique | ❌ Non implémenté |
| Attribution de badges de fin de saison | ❌ Non implémenté |
| Historique par saison | ❌ Non implémenté |

**État actuel :** La table `Season` existe dans Prisma mais n'est pas utilisée.

---

### 3. UI Calibration
**Brainstorm :** Badge "En calibration (3/5)" visible

| Feature | Status |
|---------|--------|
| Multiplicateur x2 pendant calibration | ✅ Implémenté (lib/mmr.ts) |
| Badge visuel "En calibration" | ❌ Non implémenté |
| Compteur de parties calibration (X/5) | ❌ Non implémenté |
| Animation de révélation du rang | ❌ Non implémenté |

---

### 4. Onboarding (Nouveaux Joueurs)
**Brainstorm :** Écran de bienvenue + slides explicatifs + tips contextuels

| Feature | Status |
|---------|--------|
| Écran de bienvenue | ❌ Non implémenté |
| Slides explicatifs (3) | ❌ Non implémenté |
| Tips contextuels (1ère victoire, 1ère défaite) | ❌ Non implémenté |
| Message fin de calibration | ❌ Non implémenté |

---

### 5. Best of Stats (Records Personnels)
**Brainstorm :** Affichage des meilleures performances

| Stat | Status |
|------|--------|
| Meilleure streak | ❌ Non implémenté |
| Victoire la plus rapide | ❌ Non implémenté |
| Écart max (ex: 150-18) | ❌ Non implémenté |
| Upset record (plus gros MMR gap battu) | ❌ Non implémenté |
| Réponse la plus rapide | ❌ Non implémenté (données collectées mais pas affichées) |
| Rang max atteint | ❌ Non implémenté |

---

### 6. Détection Anti-Farming
**Brainstorm :** Détection automatique de patterns suspects

| Pattern | Status |
|---------|--------|
| Win-trading (A bat B, B bat A répété) | ❌ Non implémenté |
| Score suspect (matchs toujours serrés) | ❌ Non implémenté |
| Farming fréquent (mêmes joueurs en boucle) | ❌ Non implémenté |
| Flag automatique + notification staff | ❌ Non implémenté |

---

### 7. Système de Signalement (Reports)
**Brainstorm :** Interface de signalement joueur

| Feature | Status |
|---------|--------|
| Table Report | ✅ Dans Prisma |
| Bouton "Signaler" sur profil | ❌ Non implémenté |
| Interface admin pour gérer les reports | ❌ Non implémenté |
| Workflow de résolution | ❌ Non implémenté |

---

## 🟡 Partiellement Implémenté (Moyenne Priorité)

### 8. Classements Alternatifs
**Brainstorm :** Par winrate, victoires, streak, etc.

| Classement | Status |
|------------|--------|
| MMR principal | ✅ Implémenté |
| Par Winrate (min 20 parties) | ❌ Non implémenté |
| Par nombre de victoires | ❌ Non implémenté |
| Par streak (all-time) | ❌ Non implémenté |
| Par parties jouées | ❌ Non implémenté |
| Giant Killer (victoires contre +500 MMR) | ❌ Non implémenté |

---

### 9. XP Bar (Barre de Progression)
**Brainstorm :** Progression visuelle vers le prochain rang

| Feature | Status |
|---------|--------|
| Fonction `getRankProgress()` | ✅ Implémenté (lib/mmr.ts) |
| Barre de progression visuelle sur profil | ❌ Non affiché dans l'UI |
| "50 MMR → Diamant" | ❌ Non affiché |

---

### 10. Graphique Évolution MMR
**Brainstorm :** Courbe MMR dans le temps sur le profil

| Feature | Status |
|---------|--------|
| Table MMRHistory | ✅ Dans Prisma |
| Graphique/Chart sur profil | ❌ Non implémenté |

---

### 11. Tests Unitaires MMR
**Brainstorm :** Fichier `mmr-tests.ts` avec 50 scénarios

| Feature | Status |
|---------|--------|
| Tests de base (match équilibré, favori gagne...) | ❌ Non implémenté |
| Tests score proximity | ❌ Non implémenté |
| Tests edge cases | ❌ Non implémenté |
| Tests calibration | ❌ Non implémenté |

---

## 🟢 Basse Priorité (V2+)

### 12. Mode Spectateur
**Brainstorm :** Lien vers JKLM depuis PSL

| Feature | Status |
|---------|--------|
| Page "Parties en cours" | ✅ Existe (/matches) |
| Lien "Regarder sur Popsauce" | ❌ Non implémenté |

---

### 13. Tournois Automatiques
**Brainstorm :** Weekly Cup, Monthly Championship

| Feature | Status |
|---------|--------|
| Inscription tournoi | ❌ Non implémenté |
| Génération brackets | ❌ Non implémenté |
| Interface brackets | ❌ Non implémenté |
| Distribution récompenses | ❌ Non implémenté |

---

### 14. Notifications Discord
**Brainstorm :** Webhook pour résultats, joueurs en recherche

| Feature | Status |
|---------|--------|
| Webhook résultats de match | ❌ Non implémenté |
| Notification "2 joueurs en recherche" | ❌ Non implémenté |

---

### 15. Bot Discord
**Brainstorm :** Commandes /link, /stats, /leaderboard

| Feature | Status |
|---------|--------|
| `/link` | ❌ Non implémenté |
| `/stats @user` | ❌ Non implémenté |
| `/leaderboard` | ❌ Non implémenté |
| `/queue` | ❌ Non implémenté |

---

## ✅ Implémenté

| Feature | Status |
|---------|--------|
| Auth Discord/Twitch | ✅ |
| Auth JKLM (vérification code) | ✅ |
| Matchmaking par catégorie | ✅ |
| Calcul MMR V2 (pairwise, calibration, proximity) | ✅ |
| Leaderboard par catégorie | ✅ |
| Profil joueur avec stats | ✅ |
| Historique des matchs | ✅ |
| Records de vitesse (speed records) | ✅ |
| Bot WebSocket JKLM | ✅ |
| Internationalisation FR/EN | ✅ |
| Rangs (Bronze → Master) | ✅ |
| Dashboard dynamique (refresh après match) | ✅ |
| Catégories par mode de jeu | ✅ |

---

## 📋 Roadmap Proposée

### Phase 3.1 - Quick Wins (1-2 semaines)
1. **XP Bar UI** - Afficher la barre de progression sur le dashboard
2. **UI Calibration** - Badge "En calibration (X/5)"
3. **Tests MMR** - Créer mmr.test.ts avec les scénarios

### Phase 3.2 - Stats Avancées (2-3 semaines)
4. **Best of Stats** - Records personnels sur le profil
5. **Graphique MMR** - Courbe d'évolution
6. **Classements alternatifs** - Par winrate, victoires, etc.

### Phase 3.3 - Gamification (3-4 semaines)
7. **Achievements** - Logique d'attribution + UI
8. **Onboarding** - Écran bienvenue + slides

### Phase 3.4 - Anti-Triche & Modération (2-3 semaines)
9. **Détection farming** - Algorithmes + flags
10. **Reports** - Interface signalement + admin

### Phase 4 - Features Long Terme
11. **Saisons** - Soft reset + badges
12. **Mode Spectateur** - Liens vers JKLM
13. **Notifications Discord** - Webhooks
14. **Tournois** - Inscriptions + brackets
15. **Bot Discord** - Commandes slash


# 🎮 PSL v1.2 - Changelog

## 🇬🇧 English

### ✨ New Features

#### 🔥 Win Streak System
- **Streak Tracking**: Your consecutive wins are now tracked per category
- **Best Streak Record**: Your all-time best streak is saved and displayed
- **Anti-Dodge Protection**: Leaving a queue while countdown is active now resets your streak
- **Visual Indicators**: Streak badges displayed in match history and profiles

#### 📊 Enhanced Profile Page
- **Visual Rank Badge**: Your highest rank is prominently displayed with colored styling
- **MMR Peak**: Track your all-time highest MMR for each category
- **Rank Progression Bar**: See exactly how close you are to the next rank
- **MMR Evolution Chart**: Mini graph showing your recent MMR trend
- **Time Played**: Total play time calculated from all your matches
- **Member Since**: Your account creation date is now visible
- **Current & Best Streaks**: Displayed in the profile header

#### 🏆 Match History Improvements
- **Winner Streak Badge**: See the winner's streak in each match card
- **Upset Indicator**: Special badge when a lower-ranked player wins
- **Condensed Stats**: Average MMR and MMR spread shown per match
- **Improved Layout**: Cleaner card design with more information

#### 🧠 Question Data Collection
- **All questions now tracked**: Every question from your matches is stored in the database
- **Answer logging**: Your answers and response times are recorded for future analysis
- **Foundation for Solo Training**: This data will power the upcoming training mode

#### 🌐 Full Internationalization
- All new features fully translated in French and English
- Play card component now fully localized
- Profile and match pages support both languages

### 🔮 Coming Soon
- **Solo Training Mode**: Practice with real Popsauce questions from the database

### 🐛 Bug Fixes
- **Match Duration**: Fixed incorrect match duration calculation (was hardcoded to 5 minutes)
- **Polling Intervals**: Improved from 2s to 1s for smoother countdown display
- **Lobby Polling**: Fixed from 5s to 2s for better timeout visibility

---

## 🇫🇷 Français  

### ✨ Nouvelles Fonctionnalités

#### 🔥 Système de Séries de Victoires
- **Suivi des Séries**: Vos victoires consécutives sont maintenant suivies par catégorie
- **Record de Série**: Votre meilleure série est sauvegardée et affichée
- **Protection Anti-Dodge**: Quitter la queue pendant le countdown remet votre série à zéro
- **Indicateurs Visuels**: Badges de série affichés dans l'historique et les profils

#### 📊 Page de Profil Améliorée
- **Badge de Rang Visuel**: Votre rang le plus élevé est affiché avec un style coloré
- **MMR Peak**: Suivez votre MMR le plus haut de tous les temps par catégorie
- **Barre de Progression de Rang**: Voyez exactement à quelle distance vous êtes du rang suivant
- **Graphique d'Évolution MMR**: Mini graphique montrant votre tendance MMR récente
- **Temps Joué**: Temps de jeu total calculé depuis tous vos matchs
- **Membre Depuis**: Votre date de création de compte est maintenant visible
- **Séries Actuelles & Meilleures**: Affichées dans l'en-tête du profil

#### 🏆 Améliorations de l'Historique des Matchs
- **Badge de Série du Gagnant**: Voyez la série du gagnant sur chaque carte de match
- **Indicateur d'Upset**: Badge spécial quand un joueur moins bien classé gagne
- **Stats Condensées**: MMR moyen et écart de MMR affichés par match
- **Mise en Page Améliorée**: Design de carte plus propre avec plus d'informations

#### 🧠 Collecte des Données de Questions
- **Toutes les questions sont enregistrées**: Chaque question de vos matchs est stockée en base de données
- **Historique des réponses**: Vos réponses et temps de réaction sont enregistrés pour analyse future
- **Préparation du Mode Entraînement**: Ces données alimenteront le futur mode solo

#### 🌐 Internationalisation Complète
- Toutes les nouvelles fonctionnalités traduites en français et anglais
- Composant de jeu entièrement localisé
- Pages de profil et de matchs supportent les deux langues

### 🔮 Bientôt Disponible
- **Mode Entraînement Solo**: Entraînez-vous avec de vraies questions Popsauce de la base de données

### 🐛 Corrections de Bugs
- **Durée des Matchs**: Correction du calcul de durée (était fixé à 5 minutes)
- **Intervalles de Polling**: Amélioré de 2s à 1s pour un countdown plus fluide
- **Polling du Lobby**: Corrigé de 5s à 2s pour une meilleure visibilité du timeout

---

## 📁 Technical Changes
- Added `currentStreak`, `bestStreak`, `mmrPeak` to `UserCategoryMMR` schema
- Added `mmrBefore`, `mmrAfter` tracking per match player
- 15 files modified, 678 lines added

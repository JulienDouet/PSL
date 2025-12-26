export interface PlayerResult {
  id: string; // User ID or unique identifier
  mmr: number;
  score: number;
  placement: number;
  gamesPlayed: number; // For calibration
  winStreak?: number;  // Current win streak (optional, 0 if not provided)
}

export const MMR_CONFIG = {
  DECAY: 500,           // Diviseur exponentiel pour le poids (plus petit = plus sélectif)
  PROXIMITY_POWER: 4,   // Puissance de la courbe de réduction (plus haut = moins de protection)
  SCORE_THRESHOLD: 140, // Score en dessous duquel la pénalité est maximale (très strict)
  K_FACTOR: 40,         // Facteur K augmenté (avant: 32) pour plus d'enjeux
  MIN_CHANGE: 1,        // Changement minimum garanti (sauf cas nul)
  CALIBRATION_GAMES: 5, // Nombre de parties de calibration
  CALIBRATION_MULT: 2.0, // Multiplicateur pendant la calibration
  WINSTREAK_BONUS: 0.10, // +10% par victoire consécutive pour le winner
  WINSTREAK_CAP: 5,      // Bonus max à 5 victoires (+50%)
  // === NEW: Winstreak Break System ===
  STREAK_BREAK_BONUS: 0.15,   // +15% de gain par point de streak cassée (pour le casseur)
  STREAK_BREAK_CAP: 25,       // Cap à 25 streaks max (+375% bonus max)
  STREAK_BREAK_MALUS: 0.10,   // +10% de perte par point de streak perdue (pour celui qui perd sa streak)
  // === NEW: Underdog Protection ===
  UNDERDOG_MMR_THRESHOLD: 200,  // Seuil d'écart MMR pour être considéré underdog
  UNDERDOG_SCORE_RATIO: 0.65,   // Score minimum (65% du winner) pour gain underdog
  UNDERDOG_MAX_GAIN: 8,         // Gain max possible pour un underdog
};

/**
 * Calcule le poids d'un duel en fonction de la différence de MMR.
 * Plus les MMR sont proches, plus le poids est proche de 1.
 */
export function getWeight(mmr1: number, mmr2: number): number {
  const diff = Math.abs(mmr1 - mmr2);
  return Math.exp(-diff / MMR_CONFIG.DECAY);
}

/**
 * Facteur de proximité de score - DÉSACTIVÉ.
 * Retourne toujours 1.0 (aucune réduction de pénalité).
 */
export function getScoreProximityFactor(_score: number, _winnerScore = 150): number {
  // Protection désactivée - pénalité complète peu importe le score
  return 1.0;
}

/**
 * Calcule le changement de MMR pour un joueur donné.
 * 
 * MODÈLE V3 (Balanced):
 * - Winner: gains + bonus winstreak + bonus streak break
 * - Non-winners: perte + malus streak perdue + protection underdog
 * - Underdog (200+ MMR sous le best): peut gagner avec 75%+ du score winner
 */
export function calculateMMRChange(player: PlayerResult, allPlayers: PlayerResult[]): number {
  const opponents = allPlayers.filter(p => p.id !== player.id);
  
  // Si le joueur est seul, pas de changement
  if (opponents.length === 0) return 0;

  // Trouver le winner et son score
  const winner = allPlayers.find(p => p.placement === 1);
  if (!winner) return 0;

  // Trouver le meilleur MMR dans la partie
  const bestMMR = Math.max(...allPlayers.map(p => p.mmr));
  const mmrGap = bestMMR - player.mmr;
  const isUnderdog = mmrGap >= MMR_CONFIG.UNDERDOG_MMR_THRESHOLD;

  let change = 0;

  if (player.placement === 1) {
    // === WINNER: gain basé sur le meilleur adversaire ===
    const bestOpponentMMR = Math.max(...opponents.map(o => o.mmr));
    
    // Probabilité attendue de battre le meilleur adversaire
    const expected = 1 / (1 + Math.pow(10, (bestOpponentMMR - player.mmr) / 400));
    
    // Victoire = 1
    change = MMR_CONFIG.K_FACTOR * (1 - expected);
    
    // Bonus si on a battu un adversaire significativement plus fort
    if (bestOpponentMMR > player.mmr + 100) {
      const diff = bestOpponentMMR - player.mmr;
      const upsetBonus = 1 + Math.pow(diff / 800, 2);
      change *= upsetBonus;
    }
    
    // === WINSTREAK BONUS (propre streak) ===
    // +10% par victoire consécutive, max +50% (5 wins)
    const winStreak = player.winStreak || 0;
    if (winStreak > 0) {
      const streakBonus = 1 + Math.min(winStreak, MMR_CONFIG.WINSTREAK_CAP) * MMR_CONFIG.WINSTREAK_BONUS;
      change *= streakBonus;
    }
    
    // === NEW: WINSTREAK BREAK BONUS ===
    // Si on a battu quelqu'un qui était en winstreak, bonus proportionnel à leur streak (capped)
    const loserStreaks = opponents.map(o => o.winStreak || 0);
    const maxLoserStreak = Math.min(Math.max(...loserStreaks), MMR_CONFIG.STREAK_BREAK_CAP);
    if (maxLoserStreak > 0) {
      const breakBonus = 1 + maxLoserStreak * MMR_CONFIG.STREAK_BREAK_BONUS;
      change *= breakBonus;
      console.log(`🔥 Streak break bonus: ${maxLoserStreak} streak cassée (capped), +${Math.round((breakBonus - 1) * 100)}%`);
    }
  } else {
    // === NON-WINNER ===
    
    // Score ratio par rapport au winner
    const scoreRatio = Math.min(1, player.score / winner.score);
    
    // === NEW: UNDERDOG PROTECTION ===
    // Si 200+ MMR sous le meilleur ET score >= 75% du winner, peut GAGNER du MMR
    if (isUnderdog && scoreRatio >= MMR_CONFIG.UNDERDOG_SCORE_RATIO) {
      // Gain proportionnel à la performance au-dessus du seuil
      const performanceBonus = (scoreRatio - MMR_CONFIG.UNDERDOG_SCORE_RATIO) / (1 - MMR_CONFIG.UNDERDOG_SCORE_RATIO);
      // Plus l'écart MMR est grand, plus le gain potentiel est élevé
      const underdogFactor = Math.min(2, mmrGap / MMR_CONFIG.UNDERDOG_MMR_THRESHOLD);
      change = performanceBonus * MMR_CONFIG.UNDERDOG_MAX_GAIN * underdogFactor;
      console.log(`🛡️ Underdog protection: ${mmrGap} MMR gap, ${Math.round(scoreRatio * 100)}% score, +${Math.round(change)} MMR`);
    } else {
      // Perte normale basée sur comparaison avec le winner
      
      // Score "virtuel" pour le calcul Elo
      // Max 0.15 pour un perdant qui était très proche, min 0 pour score nul
      const actual = scoreRatio * 0.15;
      
      // Probabilité attendue de battre le winner
      const expected = 1 / (1 + Math.pow(10, (winner.mmr - player.mmr) / 400));
      
      // Changement de base
      change = MMR_CONFIG.K_FACTOR * (actual - expected);
      
      // Pénalité si on était favori (MMR > winner)
      if (player.mmr > winner.mmr + 100) {
        const diff = player.mmr - winner.mmr;
        const penaltyMultiplier = 1 + Math.pow(diff / 600, 2);
        change *= penaltyMultiplier;
      }
      
      // === NEW: STREAK LOST MALUS ===
      // Si ce joueur perdait sa winstreak, pénalité supplémentaire
      const playerStreak = player.winStreak || 0;
      if (playerStreak > 0) {
        const streakLostMalus = 1 + playerStreak * MMR_CONFIG.STREAK_BREAK_MALUS;
        change *= streakLostMalus;
        console.log(`💔 Streak perdue: ${playerStreak} victoires, perte x${streakLostMalus.toFixed(2)}`);
      }
      
      // === UNDERDOG LOSS REDUCTION ===
      // Même si underdog ne gagne pas de MMR, réduire sa perte
      if (isUnderdog && change < 0) {
        const reductionFactor = Math.max(0.3, 1 - (mmrGap / 600));
        change *= reductionFactor;
      }
    }
  }

  // === CALIBRATION: Boost pour nouveaux joueurs ===
  if (player.gamesPlayed < MMR_CONFIG.CALIBRATION_GAMES) {
    change *= MMR_CONFIG.CALIBRATION_MULT;
  }

  // === ARRONDI ET LIMITES ===
  let finalChange = Math.round(change);
  
  // RÈGLE: Les non-gagnants qui ne sont pas underdog avec bon score perdent TOUJOURS du MMR
  if (player.placement > 1 && finalChange >= 0) {
    const scoreRatio = player.score / winner.score;
    const qualifiesForUnderdogGain = isUnderdog && scoreRatio >= MMR_CONFIG.UNDERDOG_SCORE_RATIO;
    if (!qualifiesForUnderdogGain) {
      finalChange = -1;
    }
  }
  
  // Plancher: le winner gagne toujours au moins 1
  if (finalChange === 0 && player.placement === 1) {
    finalChange = 1;
  }

  // Pas de plafond - les changements sont illimités
  
  return finalChange;
}

// ==========================================
// UI / RANKING UTILS
// ==========================================

export interface Rank {
  name: string;
  displayName: string;
  min: number;
  max: number;
  icon: string;
  color: string;
}

export const RANKS: Rank[] = [
  { name: 'Bronze', displayName: 'Bronze', min: 0, max: 899, icon: '🟤', color: '#CD7F32' },
  { name: 'Silver', displayName: 'Argent', min: 900, max: 1049, icon: '⚪', color: '#C0C0C0' },
  { name: 'Gold', displayName: 'Or', min: 1050, max: 1199, icon: '🟡', color: '#FFD700' },
  { name: 'Platinum', displayName: 'Platine', min: 1200, max: 1399, icon: '🔵', color: '#00CED1' },
  { name: 'Diamond', displayName: 'Diamant', min: 1400, max: 1599, icon: '💎', color: '#B9F2FF' },
  { name: 'Master', displayName: 'Maître', min: 1600, max: Infinity, icon: '👑', color: '#9B59B6' },
];

export interface RankProgress {
  currentRank: Rank;
  nextRank: Rank | null;
  progress: number; // 0 to 1
  remaining: number;
}

export function getRankProgress(mmr: number): RankProgress {
  // Trouver le rang actuel
  let currentRank = RANKS[0];
  let nextRank: Rank | null = null;
  
  for (let i = 0; i < RANKS.length; i++) {
    if (mmr >= RANKS[i].min && (RANKS[i].max === Infinity || mmr <= RANKS[i].max)) {
      currentRank = RANKS[i];
      nextRank = RANKS[i + 1] || null;
      break;
    }
  }

  // Si on est au dernier rang (Master) ou au-delà
  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      progress: 1,
      remaining: 0
    };
  }

  // Calcul progression
  const totalRange = currentRank.max - currentRank.min + 1;
  const earned = mmr - currentRank.min;
  const progress = Math.min(1, Math.max(0, earned / totalRange));
  const remaining = currentRank.max - mmr + 1;

  return {
    currentRank,
    nextRank,
    progress,
    remaining
  };
}

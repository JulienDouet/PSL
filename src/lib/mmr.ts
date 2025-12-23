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
  WINSTREAK_BONUS: 0.10, // +10% par victoire consécutive
  WINSTREAK_CAP: 5,      // Bonus max à 5 victoires (+50%)
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
 * NOUVEAU MODÈLE (Winner-Centric):
 * - Non-gagnants: comparés uniquement au 1er (score ratio + MMR diff)
 * - Gagnant: gain basé sur le meilleur adversaire (plus haut MMR)
 */
export function calculateMMRChange(player: PlayerResult, allPlayers: PlayerResult[]): number {
  const opponents = allPlayers.filter(p => p.id !== player.id);
  
  // Si le joueur est seul, pas de changement
  if (opponents.length === 0) return 0;

  // Trouver le winner et son score
  const winner = allPlayers.find(p => p.placement === 1);
  if (!winner) return 0;

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
    
    // === WINSTREAK BONUS ===
    // +10% par victoire consécutive, max +50% (5 wins)
    const winStreak = player.winStreak || 0;
    if (winStreak > 0) {
      const streakBonus = 1 + Math.min(winStreak, MMR_CONFIG.WINSTREAK_CAP) * MMR_CONFIG.WINSTREAK_BONUS;
      change *= streakBonus;
    }
  } else {
    // === NON-WINNER: perte basée sur comparaison avec le winner ===
    
    // 1. Ratio de score par rapport au winner (0 à ~1)
    const scoreRatio = Math.min(1, player.score / winner.score);
    
    // 2. Score "virtuel" pour le calcul Elo
    // Un perdant avec un bon score a un actual légèrement plus élevé
    // Max 0.15 pour un perdant qui était très proche, min 0 pour score nul
    const actual = scoreRatio * 0.15;  // Réduit de 0.35 à 0.15
    
    // 3. Probabilité attendue de battre le winner
    const expected = 1 / (1 + Math.pow(10, (winner.mmr - player.mmr) / 400));
    
    // 4. Changement de base
    change = MMR_CONFIG.K_FACTOR * (actual - expected);
    
    // 5. Pénalité si on était favori (MMR > winner)
    if (player.mmr > winner.mmr + 100) {
      const diff = player.mmr - winner.mmr;
      const penaltyMultiplier = 1 + Math.pow(diff / 600, 2);
      change *= penaltyMultiplier;
    }
  }

  // === CALIBRATION: Boost pour nouveaux joueurs ===
  if (player.gamesPlayed < MMR_CONFIG.CALIBRATION_GAMES) {
    change *= MMR_CONFIG.CALIBRATION_MULT;
  }

  // === SCORE PROXIMITY: Réduction de pénalité si proche du winner ===
  if (change < 0 && player.placement > 1) {
    const proximityFactor = getScoreProximityFactor(player.score, winner.score);
    
    // Réduire la protection si on était favori
    let adjustedFactor = proximityFactor;
    if (player.mmr > winner.mmr) {
      const advantage = player.mmr - winner.mmr;
      const penaltyRatio = Math.min(1, advantage / 500);
      adjustedFactor = proximityFactor + (1.0 - proximityFactor) * penaltyRatio;
    }
    
    change *= adjustedFactor;
  }

  // === ARRONDI ET LIMITES ===
  let finalChange = Math.round(change);
  
  // RÈGLE: Les non-gagnants perdent TOUJOURS du MMR (au moins -1)
  if (player.placement > 1 && finalChange >= 0) {
    finalChange = -1;
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

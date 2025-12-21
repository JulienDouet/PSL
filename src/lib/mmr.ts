export interface PlayerResult {
  id: string; // User ID or unique identifier
  mmr: number;
  score: number;
  placement: number;
  gamesPlayed: number; // For calibration
}

export const MMR_CONFIG = {
  DECAY: 500,           // Diviseur exponentiel pour le poids (plus petit = plus sélectif)
  PROXIMITY_POWER: 2,   // Puissance de la courbe de réduction de pénalité
  SCORE_THRESHOLD: 110, // Score en dessous duquel la pénalité est maximale
  K_FACTOR: 32,         // Facteur K standard
  MIN_CHANGE: 1,        // Changement minimum garanti (sauf cas nul)
  CALIBRATION_GAMES: 5, // Nombre de parties de calibration
  CALIBRATION_MULT: 2.0 // Multiplicateur pendant la calibration
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
 * Calcule le facteur de réduction de pénalité en cas de défaite.
 * Si le score est proche du vainqueur (150), la pénalité est réduite.
 */
export function getScoreProximityFactor(score: number, winnerScore = 150): number {
  // En dessous du seuil -> pénalité complète
  if (score < MMR_CONFIG.SCORE_THRESHOLD) {
    return 1.0;
  }
  
  // Ratio par rapport au score gagnant (ex: 140/150 = 0.93)
  const ratio = score / winnerScore;
  
  // Facteur de réduction
  // Formule: 1 - (ratio^POWER) * 0.5
  // Ex: 1 - (0.93^2 * 0.5) = 1 - 0.43 = 0.57 (pénalité réduite à 57%)
  const factor = 1 - Math.pow(ratio, MMR_CONFIG.PROXIMITY_POWER) * 0.5;
  
  // On ne réduit jamais en dessous de 50% de la pénalité (pour garder un enjeu)
  return Math.max(0.5, factor);
}

/**
 * Calcule le changement de MMR pour un joueur donné.
 * Utilise une comparaison par paire avec tous les autres joueurs.
 */
export function calculateMMRChange(player: PlayerResult, allPlayers: PlayerResult[]): number {
  let totalChange = 0;
  let totalWeight = 0;
  
  const opponents = allPlayers.filter(p => p.id !== player.id);
  
  // Si le joueur est seul (ne devrait pas arriver), 0
  if (opponents.length === 0) return 0;

  for (const opponent of opponents) {
    // 1. Poids du duel basé sur l'écart de niveau
    const weight = getWeight(player.mmr, opponent.mmr);
    totalWeight += weight;
    
    // 2. Probabilité de victoire attendue (Elo standard)
    const mmrDiff = opponent.mmr - player.mmr; 
    const expectedWin = 1 / (1 + Math.pow(10, mmrDiff / 400));
    
    // 3. Résultat réel
    let actual = 0;
    if (player.placement < opponent.placement) {
        actual = 1; // Victoire
    } else if (player.placement > opponent.placement) {
        actual = 0; // Défaite
    } else {
        actual = 0.5; // Ex aequo
    }
    
    // 4. Contribution
    totalChange += weight * MMR_CONFIG.K_FACTOR * (actual - expectedWin);
  }
  
  // Normalisation
  let result = 0;
  if (totalWeight > 0) {
      result = totalChange / totalWeight;
  }
  
  // Calibration: Boost si nouveau joueur
  if (player.gamesPlayed < MMR_CONFIG.CALIBRATION_GAMES) {
      result *= MMR_CONFIG.CALIBRATION_MULT;
  }

  // Appliquer le facteur de proximité de score (seulement si perte MMR)
  if (result < 0) {
    const proximityFactor = getScoreProximityFactor(player.score);
    result *= proximityFactor;
  }
  
  let finalChange = Math.round(result);
  
  // Plancher : min ±1 point
  if (finalChange === 0 && Math.abs(result) > 0) {
      finalChange = result > 0 ? 1 : -1;
  } else if (finalChange === 0 && player.placement === 1) {
      finalChange = 1; 
  }
  
  
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
  { name: 'Bronze', displayName: 'Bronze', min: 0, max: 999, icon: '🟤', color: '#CD7F32' },
  { name: 'Silver', displayName: 'Argent', min: 1000, max: 1299, icon: '⚪', color: '#C0C0C0' },
  { name: 'Gold', displayName: 'Or', min: 1300, max: 1599, icon: '🟡', color: '#FFD700' },
  { name: 'Platinum', displayName: 'Platine', min: 1600, max: 1899, icon: '🔵', color: '#00CED1' },
  { name: 'Diamond', displayName: 'Diamant', min: 1900, max: 2199, icon: '💎', color: '#B9F2FF' },
  { name: 'Master', displayName: 'Maître', min: 2200, max: Infinity, icon: '👑', color: '#9B59B6' },
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

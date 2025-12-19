/**
 * MMR Calculation Utilities for PSL
 * Based on the PSL Brainstorm document
 */

// ============================================
// CONSTANTS
// ============================================

export const MMR_CONFIG = {
  BASE_MMR: 1000,
  K_FACTOR: 32,
  DECAY: 500, // Weight decay for MMR difference
  CALIBRATION_GAMES: 5,
  CALIBRATION_MULTIPLIER: 2.0,
  PROXIMITY_POWER: 2,
  SCORE_THRESHOLD: 110, // Below this = full penalty
  WIN_SCORE: 150,
};

// ============================================
// RANK SYSTEM
// ============================================

export type Rank =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRAND_MASTER";

export interface RankInfo {
  name: Rank;
  displayName: string;
  icon: string;
  minMMR: number;
  maxMMR: number;
  color: string;
}

export const RANKS: RankInfo[] = [
  { name: "BRONZE", displayName: "Bronze", icon: "🥉", minMMR: 0, maxMMR: 999, color: "#CD7F32" },
  { name: "SILVER", displayName: "Argent", icon: "⚪", minMMR: 1000, maxMMR: 1299, color: "#C0C0C0" },
  { name: "GOLD", displayName: "Or", icon: "🥇", minMMR: 1300, maxMMR: 1599, color: "#FFD700" },
  { name: "PLATINUM", displayName: "Platine", icon: "💎", minMMR: 1600, maxMMR: 1899, color: "#00CED1" },
  { name: "DIAMOND", displayName: "Diamant", icon: "💠", minMMR: 1900, maxMMR: 2199, color: "#B9F2FF" },
  { name: "MASTER", displayName: "Maître", icon: "👑", minMMR: 2200, maxMMR: Infinity, color: "#9B59B6" },
  { name: "GRAND_MASTER", displayName: "Grand Maître", icon: "🏆", minMMR: 0, maxMMR: Infinity, color: "#E74C3C" },
];

/**
 * Get the rank for a given MMR and leaderboard position
 * Top 5 players are always Grand Master regardless of MMR
 */
export function getRank(mmr: number, leaderboardPosition: number): RankInfo {
  if (leaderboardPosition <= 5) {
    return RANKS.find((r) => r.name === "GRAND_MASTER")!;
  }

  return RANKS.find((r) => mmr >= r.minMMR && mmr <= r.maxMMR) || RANKS[0];
}

/**
 * Get progress towards next rank
 */
export function getRankProgress(mmr: number): {
  currentRank: RankInfo;
  nextRank: RankInfo | null;
  progress: number;
  remaining: number;
} {
  const currentRank = RANKS.find((r) => mmr >= r.minMMR && mmr <= r.maxMMR) || RANKS[0];
  const currentIndex = RANKS.findIndex((r) => r.name === currentRank.name);
  const nextRank = currentIndex < RANKS.length - 2 ? RANKS[currentIndex + 1] : null;

  if (!nextRank || currentRank.maxMMR === Infinity) {
    return { currentRank, nextRank: null, progress: 1, remaining: 0 };
  }

  const rangeSize = currentRank.maxMMR - currentRank.minMMR + 1;
  const progress = (mmr - currentRank.minMMR) / rangeSize;
  const remaining = currentRank.maxMMR - mmr + 1;

  return { currentRank, nextRank, progress, remaining };
}

// ============================================
// MMR CALCULATION (V2 - Pairwise Weighted)
// ============================================

export interface PlayerResult {
  id: string;
  mmr: number;
  placement: number;
  score: number;
  gamesPlayed: number;
}

/**
 * Calculate weight between two players based on MMR difference
 * Players with similar MMR have higher weight (more important duels)
 */
export function getWeight(myMMR: number, opponentMMR: number): number {
  const diff = Math.abs(myMMR - opponentMMR);
  return Math.exp(-diff / MMR_CONFIG.DECAY);
}

/**
 * Calculate score proximity factor for losses
 * Close losses (110-149 points) incur reduced penalty
 */
export function getScoreProximityFactor(score: number, winnerScore = MMR_CONFIG.WIN_SCORE): number {
  // Below threshold = full penalty
  if (score < MMR_CONFIG.SCORE_THRESHOLD) {
    return 1.0;
  }

  // Above threshold = exponential reduction
  const ratio = score / winnerScore;
  const factor = 1 - Math.pow(ratio, MMR_CONFIG.PROXIMITY_POWER) * 0.5;

  return Math.max(0.5, factor);
}

/**
 * Calculate MMR change for a player based on match results
 * Uses pairwise comparison with exponential weighting
 */
export function calculateMMRChange(player: PlayerResult, allPlayers: PlayerResult[]): number {
  const K = MMR_CONFIG.K_FACTOR;
  let totalChange = 0;
  let totalWeight = 0;

  const opponents = allPlayers.filter((p) => p.id !== player.id);

  for (const opponent of opponents) {
    const weight = getWeight(player.mmr, opponent.mmr);
    totalWeight += weight;

    // ELO expected win probability
    const mmrDiff = player.mmr - opponent.mmr;
    const expectedWin = 1 / (1 + Math.pow(10, -mmrDiff / 400));

    // Did player beat this opponent?
    const didBeat = player.placement < opponent.placement;
    const actual = didBeat ? 1 : 0;

    totalChange += weight * K * (actual - expectedWin);
  }

  // Normalize by total weight
  let result = totalWeight > 0 ? totalChange / totalWeight : 0;

  // Apply score proximity factor for losses
  if (result < 0) {
    const proximityFactor = getScoreProximityFactor(player.score);
    result *= proximityFactor;
  }

  // Apply calibration multiplier for new players
  if (player.gamesPlayed < MMR_CONFIG.CALIBRATION_GAMES) {
    result *= MMR_CONFIG.CALIBRATION_MULTIPLIER;
  }

  result = Math.round(result);

  // Floor: minimum ±1 point per match
  if (result === 0) {
    result = player.placement === 1 ? 1 : -1;
  }

  return result;
}

/**
 * Soft reset MMR for new season
 * newMMR = (oldMMR + 1000) / 2
 */
export function softResetMMR(mmr: number): number {
  return Math.round((mmr + MMR_CONFIG.BASE_MMR) / 2);
}

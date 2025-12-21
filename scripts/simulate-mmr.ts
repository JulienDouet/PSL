
import { calculateMMRChange, PlayerResult } from '../src/lib/mmr';

// Helper to display results
function printScenario(title: string, players: PlayerResult[]) {
  console.log(`\n=== ${title} ===`);
  console.table(players.map(p => ({
    id: p.id,
    mmr: p.mmr,
    score: p.score,
    placement: p.placement
  })));

  console.log('--- Results ---');
  players.forEach(p => {
    const change = calculateMMRChange(p, players);
    const sign = change > 0 ? '+' : '';
    console.log(`${p.id.padEnd(10)}: ${p.mmr} -> ${p.mmr + change} (${sign}${change})`);
  });
}

// ==========================================
// SCENARIOS
// ==========================================

// 1. DUEL ÉQUILIBRÉ
// Deux joueurs de même niveau. Le gagnant doit gagner autant que le perdant perd.
printScenario('1. Duel Équilibré (1500 vs 1500)', [
  { id: 'Winner', mmr: 1500, score: 150, placement: 1, gamesPlayed: 20 },
  { id: 'Loser',  mmr: 1500, score: 100, placement: 2, gamesPlayed: 20 },
]);

// 2. DUEL DÉSÉQUILIBRÉ (LOGIQUE)
// Le fort bat le faible. Gain faible pour le fort, perte faible pour le faible.
printScenario('2. Duel Déséquilibré - Logique (2000 vs 1000)', [
  { id: 'Strong', mmr: 2000, score: 150, placement: 1, gamesPlayed: 50 },
  { id: 'Weak',   mmr: 1000, score: 50,  placement: 2, gamesPlayed: 50 },
]);

// 3. DUEL UPSET (SURPRISE)
// Le faible bat le fort. Gros gain pour le faible, grosse perte pour le fort.
printScenario('3. Duel Upset - Surprise (1000 bat 2000)', [
  { id: 'Weak',   mmr: 1000, score: 150, placement: 1, gamesPlayed: 50 },
  { id: 'Strong', mmr: 2000, score: 140, placement: 2, gamesPlayed: 50 },
]);

// 4. MATCH STANDARD (4 JOUEURS)
// Mélange de niveaux.
printScenario('4. Match Standard 4 Joueurs', [
  { id: 'P1_Gold',   mmr: 1500, score: 150, placement: 1, gamesPlayed: 100 },
  { id: 'P2_Silver', mmr: 1200, score: 130, placement: 2, gamesPlayed: 100 },
  { id: 'P3_Plat',   mmr: 1800, score: 110, placement: 3, gamesPlayed: 100 },
  { id: 'P4_Bronze', mmr: 800,  score: 40,  placement: 4, gamesPlayed: 100 },
]);

// 5. CALIBRATION
// Nouveau joueur (gamesPlayed < 5) gagne/perd double.
printScenario('5. Calibration (Newbie vs Regular)', [
  { id: 'Newbie',  mmr: 1000, score: 150, placement: 1, gamesPlayed: 0 }, // Doit gagner beaucoup (x2)
  { id: 'Regular', mmr: 1200, score: 140, placement: 2, gamesPlayed: 50 },
]);

// 6. PROXIMITY SCORE (Défaite serrée vs Défaite large)
// P2 perd de peu (149 pts), P3 perd largement (50 pts).
console.log('\n=== 6. Proximity Score Test (Same MMR, different scores) ===');
const winner = { id: 'Winner', mmr: 1500, score: 150, placement: 1, gamesPlayed: 20 };
const closeLoser = { id: 'Close', mmr: 1500, score: 149, placement: 2, gamesPlayed: 20 }; // Devrait perdre moins
const farLoser = { id: 'Far',   mmr: 1500, score: 50,  placement: 2, gamesPlayed: 20 }; // Devrait perdre plein pot

console.log('--- Duel: Winner vs Close Loser (149 pts) ---');
const changeClose = calculateMMRChange(closeLoser, [winner, closeLoser]);
console.log(`Close Loser (149pts): ${changeClose}`);

console.log('--- Duel: Winner vs Far Loser (50 pts) ---');
const changeFar = calculateMMRChange(farLoser, [winner, farLoser]);
console.log(`Far Loser (50pts):   ${changeFar}`);

// 7. PLANCHER (MIN 1 POINT)
// Cas improbable où le calcul donnerait 0.
printScenario('7. Plancher Minimum (Même MMR, victoire)', [
    { id: 'A', mmr: 1000, score: 150, placement: 1, gamesPlayed: 100 },
    { id: 'B', mmr: 1000, score: 140, placement: 2, gamesPlayed: 100 }
]);

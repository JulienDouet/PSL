
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


// ===================================
// PARTIE 1: DUELS (1v1) - 13 Scénarios
// ===================================

console.log('\n🔵 --- SÉRIE 1: DUELS 1v1 (Impact écart MMR) ---');

// Cas 1-5: Victoire du favori (Higher MMR) avec écart croissant
const gaps = [0, 100, 500, 1000, 2000];
gaps.forEach((gap, i) => {
  printScenario(`1.${i+1}. Duel 1v1 - Écart ${gap} (Favori gagne)`, [
    { id: 'High', mmr: 1500 + gap, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'Low',  mmr: 1500,       score: 100, placement: 2, gamesPlayed: 50 }
  ]);
});

// Cas 6-10: Upset (Low MMR gagne) avec écart croissant
gaps.forEach((gap, i) => {
  printScenario(`1.${i+6}. Duel 1v1 - Écart ${gap} (Outsider gagne)`, [
    { id: 'Low',  mmr: 1500,       score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'High', mmr: 1500 + gap, score: 140, placement: 2, gamesPlayed: 50 }
  ]);
});

// Cas 11-13: Impact du score de défaite (Proximity)
console.log('\n🔵 --- SÉRIE 2: DUELS 1v1 (Impact Score de défaite) ---');
printScenario('2.1. Défaite serrée (149 pts) - Écart 0', [
    { id: 'A', mmr: 1500, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'B', mmr: 1500, score: 149, placement: 2, gamesPlayed: 50 }
]);
printScenario('2.2. Défaite moyenne (110 pts) - Écart 0', [
    { id: 'A', mmr: 1500, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'B', mmr: 1500, score: 110, placement: 2, gamesPlayed: 50 }
]);
printScenario('2.3. Défaite large (<110 pts) - Écart 0', [
    { id: 'A', mmr: 1500, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'B', mmr: 1500, score: 50,  placement: 2, gamesPlayed: 50 }
]);

// ===================================
// PARTIE 2: LOBBY 3 JOUEURS (FFA)
// ===================================
console.log('\n🟢 --- SÉRIE 3: LOBBY 3 JOUEURS ---');

printScenario('3.1. 3 Joueurs Équilibrés', [
  { id: 'P1', mmr: 1500, score: 150, placement: 1, gamesPlayed: 50 },
  { id: 'P2', mmr: 1500, score: 140, placement: 2, gamesPlayed: 50 },
  { id: 'P3', mmr: 1500, score: 100, placement: 3, gamesPlayed: 50 }
]);

printScenario('3.2. Sandwich (High - Med - Low) - Logique', [
  { id: 'High', mmr: 2000, score: 150, placement: 1, gamesPlayed: 50 },
  { id: 'Med',  mmr: 1500, score: 120, placement: 2, gamesPlayed: 50 },
  { id: 'Low',  mmr: 1000, score: 80,  placement: 3, gamesPlayed: 50 }
]);

printScenario('3.3. Sandwich - Upset Total (Low bat tout le monde)', [
  { id: 'Low',  mmr: 1000, score: 150, placement: 1, gamesPlayed: 50 },
  { id: 'Med',  mmr: 1500, score: 140, placement: 2, gamesPlayed: 50 },
  { id: 'High', mmr: 2000, score: 130, placement: 3, gamesPlayed: 50 }
]);

// ===================================
// PARTIE 3: LOBBY 4 JOUEURS (FFA)
// ===================================
console.log('\n🟡 --- SÉRIE 4: LOBBY 4 JOUEURS ---');

printScenario('4.1. Lobby Disparate (800 à 2200)', [
  { id: 'Master', mmr: 2200, score: 150, placement: 1, gamesPlayed: 100 },
  { id: 'Gold',   mmr: 1500, score: 130, placement: 2, gamesPlayed: 100 },
  { id: 'Silver', mmr: 1200, score: 110, placement: 3, gamesPlayed: 100 },
  { id: 'Bronze', mmr: 800,  score: 50,  placement: 4, gamesPlayed: 100 }
]);

printScenario('4.2. Lobby Disparate - Master finit dernier', [
  { id: 'Gold',   mmr: 1500, score: 150, placement: 1, gamesPlayed: 100 },
  { id: 'Silver', mmr: 1200, score: 140, placement: 2, gamesPlayed: 100 },
  { id: 'Bronze', mmr: 800,  score: 130, placement: 3, gamesPlayed: 100 },
  { id: 'Master', mmr: 2200, score: 100, placement: 4, gamesPlayed: 100 }
]);

// ===================================
// PARTIE 4: LOBBY 5 JOUEURS (FFA)
// ===================================
console.log('\n🟠 --- SÉRIE 5: LOBBY 5 JOUEURS ---');

printScenario('5.1. Lobby Full Équilibré (Tous 1500)', [
    { id: 'P1', mmr: 1500, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'P2', mmr: 1500, score: 145, placement: 2, gamesPlayed: 50 },
    { id: 'P3', mmr: 1500, score: 140, placement: 3, gamesPlayed: 50 },
    { id: 'P4', mmr: 1500, score: 130, placement: 4, gamesPlayed: 50 },
    { id: 'P5', mmr: 1500, score: 100, placement: 5, gamesPlayed: 50 }
]);

printScenario('5.2. David contre Goliaths (1 Low vs 4 Highs) - Low gagne', [
    { id: 'Low',   mmr: 1000, score: 150, placement: 1, gamesPlayed: 50 }, // Devrait gagner énormément
    { id: 'High1', mmr: 2000, score: 140, placement: 2, gamesPlayed: 50 },
    { id: 'High2', mmr: 2000, score: 135, placement: 3, gamesPlayed: 50 },
    { id: 'High3', mmr: 2000, score: 130, placement: 4, gamesPlayed: 50 },
    { id: 'High4', mmr: 2000, score: 120, placement: 5, gamesPlayed: 50 }
]);

printScenario('5.3. Goliath contre Davids (1 High vs 4 Lows) - High perd', [
    { id: 'Low1', mmr: 1000, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'Low2', mmr: 1000, score: 140, placement: 2, gamesPlayed: 50 },
    { id: 'Low3', mmr: 1000, score: 130, placement: 3, gamesPlayed: 50 },
    { id: 'Low4', mmr: 1000, score: 120, placement: 4, gamesPlayed: 50 },
    { id: 'High', mmr: 2000, score: 100, placement: 5, gamesPlayed: 50 } // Devrait perdre énormément
]);

// ===================================
// PARTIE 5: CALIBRATION 
// ===================================
console.log('\n🟣 --- SÉRIE 6: CALIBRATION ---');

printScenario('6.1. Nouveau Joueur (0 games) finit 1er', [
    { id: 'New', mmr: 1000, score: 150, placement: 1, gamesPlayed: 0 },
    { id: 'Old', mmr: 1200, score: 140, placement: 2, gamesPlayed: 50 }
]);

printScenario('6.2. Nouveau Joueur (0 games) finit dernier', [
    { id: 'Old', mmr: 1200, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'New', mmr: 1000, score: 100, placement: 2, gamesPlayed: 0 }
]);

printScenario('6.3. Fin de calibration (4ème game)', [
    { id: 'New', mmr: 1100, score: 150, placement: 1, gamesPlayed: 4 },
    { id: 'Old', mmr: 1200, score: 140, placement: 2, gamesPlayed: 50 }
]);

printScenario('6.4. Post calibration (5ème game = normal)', [
    { id: 'New', mmr: 1150, score: 150, placement: 1, gamesPlayed: 5 },
    { id: 'Old', mmr: 1200, score: 140, placement: 2, gamesPlayed: 50 }
]);

// ===================================
// PARTIE 7: WINSTREAK BREAK (NEW V3)
// ===================================
console.log('\n🔥 --- SÉRIE 7: WINSTREAK BREAK ---');

printScenario('7.1. Casseur (1200) bat Joueur en streak 5 (1500)', [
    { id: 'Casseur', mmr: 1200, score: 150, placement: 1, gamesPlayed: 50, winStreak: 0 },
    { id: 'Streak5', mmr: 1500, score: 140, placement: 2, gamesPlayed: 50, winStreak: 5 }
]);

printScenario('7.2. Casseur (1200) bat Joueur en streak 10 (1500)', [
    { id: 'Casseur', mmr: 1200, score: 150, placement: 1, gamesPlayed: 50, winStreak: 0 },
    { id: 'Streak10', mmr: 1500, score: 140, placement: 2, gamesPlayed: 50, winStreak: 10 }
]);

printScenario('7.3. Casseur (1200) bat Joueur en streak 25 (1500)', [
    { id: 'Casseur', mmr: 1200, score: 150, placement: 1, gamesPlayed: 50, winStreak: 0 },
    { id: 'Streak25', mmr: 1500, score: 140, placement: 2, gamesPlayed: 50, winStreak: 25 }
]);

printScenario('7.4. Casseur (1200) bat Joueur en streak 50 (1500) - Capped at 25', [
    { id: 'Casseur', mmr: 1200, score: 150, placement: 1, gamesPlayed: 50, winStreak: 0 },
    { id: 'Streak50', mmr: 1500, score: 140, placement: 2, gamesPlayed: 50, winStreak: 50 }
]);

// ===================================
// PARTIE 8: UNDERDOG PROTECTION (NEW V3)
// ===================================
console.log('\n🛡️ --- SÉRIE 8: UNDERDOG PROTECTION ---');

printScenario('8.1. Underdog (1000) fait 97 pts (64.6%) vs Winner (1400, 150pts) - Seuil 65% pas atteint', [
    { id: 'Winner', mmr: 1400, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'Underdog', mmr: 1000, score: 97, placement: 2, gamesPlayed: 50 }
]);

printScenario('8.2. Underdog (1000) fait 98 pts (65.3%) vs Winner (1400, 150pts) - Seuil 65% atteint!', [
    { id: 'Winner', mmr: 1400, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'Underdog', mmr: 1000, score: 98, placement: 2, gamesPlayed: 50 }
]);

printScenario('8.3. Underdog (1000) fait 110 pts (73.3%) vs Winner (1400, 150pts)', [
    { id: 'Winner', mmr: 1400, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'Underdog', mmr: 1000, score: 110, placement: 2, gamesPlayed: 50 }
]);

printScenario('8.4. Underdog (1000) fait 145 pts (96.6%) vs Winner (1400, 150pts) - Très proche!', [
    { id: 'Winner', mmr: 1400, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'Underdog', mmr: 1000, score: 145, placement: 2, gamesPlayed: 50 }
]);

printScenario('8.5. Non-underdog (1250) fait 110 pts vs Winner (1400, 150pts) - Pas assez d\'écart MMR', [
    { id: 'Winner', mmr: 1400, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'NotUnderdog', mmr: 1250, score: 110, placement: 2, gamesPlayed: 50 }
]);

// ===================================
// PARTIE 9: COMBINAISONS (NEW V3)
// ===================================
console.log('\n⚡ --- SÉRIE 9: COMBINAISONS ---');

printScenario('9.1. Underdog (1000) bat Joueur en streak 10 (1600)', [
    { id: 'Underdog', mmr: 1000, score: 150, placement: 1, gamesPlayed: 50, winStreak: 0 },
    { id: 'Streak10', mmr: 1600, score: 140, placement: 2, gamesPlayed: 50, winStreak: 10 }
]);

printScenario('9.2. Lobby 3 joueurs avec underdog', [
    { id: 'Master', mmr: 1600, score: 150, placement: 1, gamesPlayed: 50 },
    { id: 'Gold', mmr: 1200, score: 130, placement: 2, gamesPlayed: 50 },
    { id: 'Underdog', mmr: 1000, score: 120, placement: 3, gamesPlayed: 50 }
]);

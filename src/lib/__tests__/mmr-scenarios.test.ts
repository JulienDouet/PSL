/**
 * Test exhaustif du système MMR - Focus range 800-1300
 * Exécuter avec: npx tsx src/lib/__tests__/mmr-scenarios.test.ts
 */

import { calculateMMRChange, type PlayerResult } from '../mmr';

// Helper pour créer un joueur
function player(id: string, mmr: number, score: number, placement: number, gamesPlayed = 10, winStreak = 0): PlayerResult {
  return { id, mmr, score, placement, gamesPlayed, winStreak };
}

// Helper pour afficher les résultats
function testScenario(name: string, players: PlayerResult[]) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${name}`);
  console.log('='.repeat(60));
  
  // Afficher les joueurs
  console.log('\nJoueurs:');
  players.forEach(p => {
    console.log(`  ${p.id}: MMR ${p.mmr}, Score ${p.score}, Place #${p.placement}`);
  });
  
  // Calculer les changements
  console.log('\nRésultats MMR:');
  let totalChange = 0;
  players.forEach(p => {
    const change = calculateMMRChange(p, players);
    totalChange += change;
    const emoji = change > 0 ? '📈' : change < 0 ? '📉' : '➖';
    console.log(`  ${emoji} ${p.id}: ${change > 0 ? '+' : ''}${change} (${p.mmr} → ${p.mmr + change})`);
  });
  
  console.log(`\n  Σ Total: ${totalChange} (devrait être ~0)`);
}

console.log('\n🎮 TEST EXHAUSTIF DU SYSTÈME MMR');
console.log('Focus: Range 800-1300 MMR\n');

// ===== SCÉNARIOS 2 JOUEURS =====

console.log('\n' + '🔥'.repeat(30));
console.log('PARTIE 1: DUELS (2 joueurs)');
console.log('🔥'.repeat(30));

testScenario('Duel équilibré - MMR identiques (1000 vs 1000)', [
  player('Winner', 1000, 150, 1),
  player('Loser', 1000, 120, 2),
]);

testScenario('Duel équilibré - Score serré (1000 vs 1000)', [
  player('Winner', 1000, 150, 1),
  player('Loser', 1000, 145, 2),
]);

testScenario('Favori gagne (1200 bat 900)', [
  player('Favori', 1200, 150, 1),
  player('Underdog', 900, 100, 2),
]);

testScenario('Favori gagne de peu (1200 bat 900, score serré)', [
  player('Favori', 1200, 150, 1),
  player('Underdog', 900, 140, 2),
]);

testScenario('UPSET! Underdog gagne (900 bat 1200)', [
  player('Underdog', 900, 150, 1),
  player('Favori', 1200, 100, 2),
]);

testScenario('UPSET serré! Underdog gagne (900 bat 1200, score proche)', [
  player('Underdog', 900, 150, 1),
  player('Favori', 1200, 145, 2),
]);

testScenario('Petit écart MMR (1100 bat 1000)', [
  player('Légèrement favori', 1100, 150, 1),
  player('Légèrement underdog', 1000, 110, 2),
]);

testScenario('Gros écart MMR - Favori gagne (1300 bat 800)', [
  player('Top player', 1300, 150, 1),
  player('Débutant', 800, 80, 2),
]);

testScenario('GROS UPSET! (800 bat 1300)', [
  player('Débutant', 800, 150, 1),
  player('Top player', 1300, 100, 2),
]);

// ===== SCÉNARIOS 3 JOUEURS =====

console.log('\n' + '🔥'.repeat(30));
console.log('PARTIE 2: MATCHS 3 JOUEURS');
console.log('🔥'.repeat(30));

testScenario('3 joueurs équilibrés (1000/1000/1000)', [
  player('1er', 1000, 150, 1),
  player('2ème', 1000, 130, 2),
  player('3ème', 1000, 100, 3),
]);

testScenario('3 joueurs - Favori gagne (1200/1000/900)', [
  player('Favori', 1200, 150, 1),
  player('Milieu', 1000, 120, 2),
  player('Underdog', 900, 90, 3),
]);

testScenario('3 joueurs - Milieu gagne (1200/1000/900)', [
  player('Favori', 1200, 130, 2),
  player('Milieu', 1000, 150, 1),
  player('Underdog', 900, 80, 3),
]);

testScenario('3 joueurs - UPSET Underdog gagne! (1200/1000/900)', [
  player('Favori', 1200, 140, 2),
  player('Milieu', 1000, 100, 3),
  player('Underdog', 900, 150, 1),
]);

testScenario('3 joueurs - Scores très serrés', [
  player('1er', 1100, 150, 1),
  player('2ème', 1050, 148, 2),
  player('3ème', 1000, 145, 3),
]);

testScenario('3 joueurs - Range large (1300/1000/800)', [
  player('Top', 1300, 150, 1),
  player('Moyen', 1000, 110, 2),
  player('Bas', 800, 70, 3),
]);

testScenario('3 joueurs - MEGA UPSET (800 bat 1300 et 1200)', [
  player('Underdog', 800, 150, 1),
  player('Favori1', 1300, 130, 2),
  player('Favori2', 1200, 100, 3),
]);

// ===== SCÉNARIOS 4+ JOUEURS =====

console.log('\n' + '🔥'.repeat(30));
console.log('PARTIE 3: GROS MATCHS (4+ joueurs)');
console.log('🔥'.repeat(30));

testScenario('4 joueurs - Lobbby typique (1200/1100/1000/900)', [
  player('P1', 1200, 150, 1),
  player('P2', 1100, 130, 2),
  player('P3', 1000, 100, 3),
  player('P4', 900, 70, 4),
]);

testScenario('4 joueurs - Underdog gagne (1200/1100/1000/900)', [
  player('P1', 1200, 140, 2),
  player('P2', 1100, 120, 3),
  player('P3', 1000, 90, 4),
  player('P4', 900, 150, 1),
]);

testScenario('5 joueurs - Match équilibré tous ~1000', [
  player('P1', 1050, 150, 1),
  player('P2', 1020, 140, 2),
  player('P3', 1000, 120, 3),
  player('P4', 980, 100, 4),
  player('P5', 950, 80, 5),
]);

testScenario('6 joueurs - Grande variété MMR', [
  player('Top', 1300, 150, 1),
  player('High', 1200, 130, 2),
  player('Mid+', 1100, 110, 3),
  player('Mid', 1000, 90, 4),
  player('Low', 900, 70, 5),
  player('Lowest', 800, 50, 6),
]);

testScenario('6 joueurs - CHAOS (Plus bas MMR gagne)', [
  player('Top', 1300, 100, 4),
  player('High', 1200, 80, 5),
  player('Mid+', 1100, 60, 6),
  player('Mid', 1000, 120, 3),
  player('Low', 900, 140, 2),
  player('Lowest', 800, 150, 1),
]);

// ===== SCÉNARIOS CALIBRATION =====

console.log('\n' + '🔥'.repeat(30));
console.log('PARTIE 4: CALIBRATION (nouveaux joueurs)');
console.log('🔥'.repeat(30));

testScenario('Nouveau joueur gagne (2 games played)', [
  player('Nouveau', 1000, 150, 1, 2),
  player('Vétéran', 1000, 120, 2, 50),
]);

testScenario('Nouveau joueur perd (2 games played)', [
  player('Vétéran', 1000, 150, 1, 50),
  player('Nouveau', 1000, 100, 2, 2),
]);

testScenario('Deux nouveaux joueurs', [
  player('Nouveau1', 1000, 150, 1, 1),
  player('Nouveau2', 1000, 120, 2, 3),
]);

// ===== CAS LIMITES =====

console.log('\n' + '🔥'.repeat(30));
console.log('PARTIE 5: CAS LIMITES');
console.log('🔥'.repeat(30));

testScenario('Score = 0 (AFK)', [
  player('Winner', 1000, 150, 1),
  player('AFK', 1000, 0, 2),
]);

testScenario('Scores très bas', [
  player('Winner', 1000, 150, 1),
  player('Loser1', 1000, 50, 2),
  player('Loser2', 1000, 30, 3),
]);

testScenario('Très gros écart MMR (1300 vs 800)', [
  player('Pro', 1300, 150, 1),
  player('Noob', 800, 50, 2),
]);

// ===== WINSTREAK =====

console.log('\n' + '🔥'.repeat(30));
console.log('PARTIE 6: WINSTREAK BONUS');
console.log('🔥'.repeat(30));

testScenario('Winner sans streak vs Winner avec 3 wins streak', [
  player('NoStreak', 1000, 150, 1, 10, 0),
  player('Opponent', 1000, 120, 2, 10, 0),
]);

testScenario('Winner avec 3 wins streak (+30%)', [
  player('Streak3', 1000, 150, 1, 10, 3),
  player('Opponent', 1000, 120, 2, 10, 0),
]);

testScenario('Winner avec 5 wins streak (+50% max)', [
  player('Streak5', 1000, 150, 1, 10, 5),
  player('Opponent', 1000, 120, 2, 10, 0),
]);

testScenario('Winner avec 10 wins streak (capped at +50%)', [
  player('Streak10', 1000, 150, 1, 10, 10),
  player('Opponent', 1000, 120, 2, 10, 0),
]);

testScenario('Underdog avec 3 wins streak gagne (upset + streak)', [
  player('StreakUnderdog', 900, 150, 1, 10, 3),
  player('Favori', 1200, 100, 2, 10, 0),
]);

console.log('\n' + '✅'.repeat(30));
console.log('FIN DES TESTS');
console.log('✅'.repeat(30) + '\n');

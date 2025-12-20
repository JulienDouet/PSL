import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('📥 [API] Callback reçu du bot:', JSON.stringify(body, null, 2));

    const { roomCode, scores } = body;

    // Validation basique
    if (!roomCode || !scores || !Array.isArray(scores)) {
        console.error('❌ Données invalides reçues');
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // 1. Créer le match en base
    const match = await prisma.match.create({
        data: {
            lobbyCode: roomCode,
            status: 'COMPLETED',
            startedAt: new Date(Date.now() - 1000 * 60 * 5), // Approx 5 min ago
            endedAt: new Date(),
            category: 'GP', // Par défaut
        }
    });

    console.log(`✅ Match créé: ${match.id}`);

    // 2. Associer les joueurs et calculer le MMR (V2)
    // D'abord, on récupère tous les utilisateurs concernés
    const nicknames = scores.map((s: any) => s.nickname);
    
    // On cherche par jklmUsername ou displayName
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { jklmUsername: { in: nicknames, mode: 'insensitive' } },
                { displayName: { in: nicknames, mode: 'insensitive' } }
            ]
        }
    });

    // On prépare les objets pour le calcul MMR
    // Il nous faut le MMR actuel de chaque joueur
    // Pour l'instant on utilise user.mmr (Global/GP par défaut)
    
    // Map pour accès rapide user -> score/placement
    const resultsMap = new Map();
    scores.forEach((s: any) => {
        // Normalisation très basique pour la correspondance
        resultsMap.set(s.nickname.toLowerCase(), s);
    });

    const playersForCalculation: import('@/lib/mmr').PlayerResult[] = [];
    const userMap = new Map<string, typeof users[0]>();

    for (const user of users) {
        // Trouver le score correspondant
        // On essaie jklmUsername puis displayName
        let scoreData = resultsMap.get(user.jklmUsername?.toLowerCase()) || resultsMap.get(user.displayName?.toLowerCase());
        
        if (scoreData) {
            playersForCalculation.push({
                id: user.id,
                mmr: user.mmr,
                score: scoreData.score,
                placement: scoreData.placement,
                gamesPlayed: user.gamesPlayed // Important pour la calibration (V2)
            });
            userMap.set(user.id, user);
        }
    }

    console.log(`📊 Calcul MMR V2 pour ${playersForCalculation.length} joueurs...`);

    // Import dynamique pour éviter les soucis de build si le fichier n'est pas encore là (en théorie il est là)
    // Mais ici on est dans un fichier route, on peut importer en haut. 
    // Pour l'outil replace, je vais assumer que l'import est ajouté en haut ou que je peux l'utiliser d'ici.
    // Je vais utiliser l'import déjà ajouté ou faire un require si besoin, mais mieux vaut cleaner le fichier.
    // NOTE: Impossible d'ajouter l'import en haut avec ce bloc. Je vais devoir faire un replace global ou assumer l'import.
    // Je vais utiliser une instruction séparée pour l'import.
    // Ah, multi_replace n'est pas dispo en parallèle.
    // Je vais faire un replace du contenu de la boucle.
    
    const { calculateMMRChange } = await import('@/lib/mmr');

    for (const playerStats of playersForCalculation) {
        const mmrChange = calculateMMRChange(playerStats, playersForCalculation);
        const user = userMap.get(playerStats.id)!;
        
        console.log(`📈 ${user.name}: ${user.mmr} -> ${user.mmr + mmrChange} (${mmrChange > 0 ? '+' : ''}${mmrChange})`);

        // Sauvegarde MatchPlayer
        await prisma.matchPlayer.create({
            data: {
                matchId: match.id,
                userId: user.id,
                placement: playerStats.placement,
                points: playerStats.score,
                mmrBefore: user.mmr,
                mmrAfter: user.mmr + mmrChange,
                mmrChange: mmrChange
            }
        });

        // Mise à jour User (Global MMR)
        // TODO: Gérer UserCategoryMMR plus tard
        await prisma.user.update({
            where: { id: user.id },
            data: {
                gamesPlayed: { increment: 1 },
                mmr: { increment: mmrChange }
            }
        });
    }

    return NextResponse.json({ success: true, matchId: match.id, processedPlayers: playersForCalculation.length });
  } catch (err) {
    console.error('❌ Erreur callback:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

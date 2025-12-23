import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearMatch } from '@/lib/queue';
import type { Category } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('📥 [API] Callback reçu du bot:', JSON.stringify(body, null, 2));

    const { roomCode, scores, category: rawCategory } = body;
    const category: Category = rawCategory || 'GP_FR';

    // Validation basique
    if (!roomCode || !scores || !Array.isArray(scores)) {
        console.error('❌ Données invalides reçues');
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Nettoyer le match des pendingMatches (libère les joueurs du mode "matched")
    clearMatch(roomCode);
    console.log(`🧹 Match ${roomCode} nettoyé de pendingMatches`);

    // 1. Créer le match en base
    const match = await prisma.match.create({
        data: {
            lobbyCode: roomCode,
            status: 'COMPLETED',
            startedAt: new Date(Date.now() - 1000 * 60 * 5), // Approx 5 min ago
            endedAt: new Date(),
            category,
        }
    });

    console.log(`✅ Match créé: ${match.id}`);

    // 2. Associer les joueurs et calculer le MMR (V2)
    // On essaie de matcher par auth (Discord ID, Twitch ID) en priorité
    // puis par nickname (jklmUsername, displayName) en fallback
    
    const playersForCalculation: import('@/lib/mmr').PlayerResult[] = [];
    const userMap = new Map<string, any>();
    const nicknameToUser = new Map<string, string>();

    for (const scoreData of scores) {
        let user = null;
        
        // 1. Essayer de matcher par auth (Discord/Twitch ID)
        if (scoreData.auth?.id && scoreData.auth?.service) {
            const authService = scoreData.auth.service.toLowerCase();
            const authId = String(scoreData.auth.id);
            
            // Chercher l'account avec ce service/ID
            const account = await prisma.account.findFirst({
                where: {
                    providerId: authService,
                    accountId: authId
                },
                include: { 
                    user: {
                        include: {
                            categoryMMRs: {
                                where: { category }
                            }
                        }
                    } 
                }
            });
            
            if (account?.user) {
                user = account.user;
                console.log(`✅ Match par auth: ${scoreData.nickname} -> ${user.name} (${authService}:${authId})`);
            }
        }
        
        // 2. Essayer par expectedPlayer (infos du bot sur les joueurs attendus)
        if (!user && scoreData.expectedPlayer?.id) {
            const authId = String(scoreData.expectedPlayer.id);
            const authService = scoreData.expectedPlayer.service;
            
            const account = await prisma.account.findFirst({
                where: {
                    providerId: authService,
                    accountId: authId
                },
                include: { 
                    user: {
                        include: {
                            categoryMMRs: {
                                where: { category }
                            }
                        }
                    } 
                }
            });
            
            if (account?.user) {
                user = account.user;
                console.log(`✅ Match par expectedPlayer: ${scoreData.nickname} -> ${user.name}`);
            }
        }
        
        // 3. Fallback: matcher par nickname
        if (!user) {
            const nick = scoreData.nickname?.toLowerCase();
            user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { jklmUsername: { equals: nick, mode: 'insensitive' } },
                        { displayName: { equals: nick, mode: 'insensitive' } },
                        { name: { equals: nick, mode: 'insensitive' } }
                    ]
                },
                include: {
                    categoryMMRs: {
                        where: { category }
                    }
                }
            });
            if (user) {
                console.log(`✅ Match par nickname: ${scoreData.nickname} -> ${user.name}`);
            }
        }
        
        if (user) {
            // Récupérer le MMR de la catégorie (ou 1000 par défaut)
            const catMMRData = (user as any).categoryMMRs?.[0];
            const currentMMR = catMMRData?.mmr ?? 1000;
            const gamesPlayed = catMMRData?.gamesPlayed ?? 0;

            // Calculer le winstreak actuel (victoires consécutives récentes)
            const recentMatches = await prisma.matchPlayer.findMany({
                where: { userId: user.id, match: { category } },
                orderBy: { match: { createdAt: 'desc' } },
                take: 10, // Regarder les 10 derniers matchs max
                select: { placement: true }
            });
            
            let winStreak = 0;
            for (const mp of recentMatches) {
                if (mp.placement === 1) {
                    winStreak++;
                } else {
                    break; // Streak cassé
                }
            }

            console.log(`👤 ${user.name} - MMR ${category}: ${currentMMR} (${gamesPlayed} games, ${winStreak} winstreak)`);

            playersForCalculation.push({
                id: user.id,
                mmr: currentMMR,
                score: scoreData.score,
                placement: scoreData.placement,
                gamesPlayed: gamesPlayed,
                winStreak: winStreak
            });
            userMap.set(user.id, user);
            nicknameToUser.set(scoreData.nickname, user.id);
        } else {
            console.log(`⚠️ Joueur non trouvé: ${scoreData.nickname}`);
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
        const oldMMR = playerStats.mmr;
        const newMMR = oldMMR + mmrChange;
        
        console.log(`📈 ${user.name} (${category}): ${oldMMR} -> ${newMMR} (${mmrChange > 0 ? '+' : ''}${mmrChange})`);

        // Sauvegarde MatchPlayer
        await prisma.matchPlayer.create({
            data: {
                matchId: match.id,
                userId: user.id,
                placement: playerStats.placement,
                points: playerStats.score,
                mmrBefore: oldMMR,
                mmrAfter: newMMR,
                mmrChange: mmrChange
            }
        });

        // Mise à jour User (Juste gamesPlayed global, plus de MMR global)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                gamesPlayed: { increment: 1 }
            }
        });

        // Mise à jour UserCategoryMMR (MMR par catégorie)
        await prisma.userCategoryMMR.upsert({
            where: {
                userId_category: {
                    userId: user.id,
                    category
                }
            },
            create: {
                userId: user.id,
                category,
                mmr: 1000 + mmrChange,
                gamesPlayed: 1
            },
            update: {
                mmr: { increment: mmrChange },
                gamesPlayed: { increment: 1 }
            }
        });
    }

    // 4. Sauvegarder les réponses (MatchAnswer)
    const answers = (body as any).answers;
    if (answers && Array.isArray(answers)) {
        console.log(`📝 Traitement de ${answers.length} réponses...`);
        const answersData = answers.map((ans: any) => ({
            matchId: match.id,
            userId: nicknameToUser.get(ans.nickname) || null,
            peerId: typeof ans.peerId === 'number' ? ans.peerId : parseInt(ans.peerId) || 0,
            roundIndex: ans.roundIndex,
            question: ans.question,
            answer: ans.answer,
            playerAnswer: (ans.playerAnswer || ans.answer).toLowerCase().replace(/[^a-z0-9]/g, ''), // Normalisation: minuscule + alphanumérique only
            elapsedTime: ans.elapsedTime,
        }));

        if (answersData.length > 0) {
             await prisma.matchAnswer.createMany({
                data: answersData
            });
            console.log(`✅ ${answersData.length} réponses sauvegardées en base.`);
        }
    }

    return NextResponse.json({ success: true, matchId: match.id, processedPlayers: playersForCalculation.length });
  } catch (err) {
    console.error('❌ Erreur callback:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

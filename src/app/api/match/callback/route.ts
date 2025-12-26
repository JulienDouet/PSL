import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearMatch } from '@/lib/queue';
import type { Category } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('📥 [API] Callback reçu du bot:', JSON.stringify(body, null, 2));

    const { roomCode, scores, category: rawCategory, cancelled, reason } = body;
    const category: Category = rawCategory || 'GP_FR';

    // Validation: roomCode toujours requis
    if (!roomCode) {
        console.error('❌ roomCode manquant');
        return NextResponse.json({ error: 'Missing roomCode' }, { status: 400 });
    }

    // === CAS D'ANNULATION ===
    // Le bot signale que le match a été annulé (personne n'a rejoint, timeout, etc.)
    if (cancelled) {
        console.log(`🚫 [API] Match ${roomCode} annulé: ${reason || 'Raison inconnue'}`);
        clearMatch(roomCode);
        console.log(`🧹 Match ${roomCode} nettoyé de pendingMatches (annulé)`);
        return NextResponse.json({ 
            success: true, 
            message: 'Match cancelled and cleared',
            roomCode,
            reason 
        });
    }

    // === CAS NORMAL: Résultats de match ===
    if (!scores || !Array.isArray(scores)) {
        console.error('❌ Données invalides reçues (pas de scores)');
        return NextResponse.json({ error: 'Invalid data: missing scores' }, { status: 400 });
    }

    // Nettoyer le match des pendingMatches (libère les joueurs du mode "matched")
    clearMatch(roomCode);
    console.log(`🧹 Match ${roomCode} nettoyé de pendingMatches`);

    // 1. Créer le match en base
    // startedAt est passé par le bot (timestamp de quand le match a été trouvé)
    const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
    
    const match = await prisma.match.create({
        data: {
            lobbyCode: roomCode,
            status: 'COMPLETED',
            startedAt,
            endedAt: new Date(),
            category,
        }
    });

    console.log(`✅ Match créé: ${match.id}`);

    // 2. Associer les joueurs et calculer le MMR (V2)
    // On essaie de matcher par auth (Discord ID, Twitch ID) en priorité
    // puis par nickname (jklmUsername, displayName) en fallback
    
    // First, check if this was a ranked match (some players have expectedPlayer)
    const hasExpectedPlayers = scores.some((s: any) => s.expectedPlayer != null);
    
    const playersForCalculation: import('@/lib/mmr').PlayerResult[] = [];
    const userMap = new Map<string, any>();
    const nicknameToUser = new Map<string, string>();

    for (const scoreData of scores) {
        // Skip unmatched players in ranked matches
        // If hasExpectedPlayers is true (ranked match) and this player has no expectedPlayer, skip them
        if (hasExpectedPlayers && !scoreData.expectedPlayer) {
            console.log(`⚠️ Skipping unmatched player: ${scoreData.nickname} (not in queue, no MMR change)`);
            continue;
        }
        
        let user = null;
        
        // 1. Essayer de matcher par auth (Discord/Twitch ID)
        if (scoreData.auth?.id && scoreData.auth?.service) {
            const authService = scoreData.auth.service.toLowerCase();
            const authId = String(scoreData.auth.id);
            
            // Special case for JKLM - lookup by jklmUsername in User table
            if (authService === 'jklm') {
                // For JKLM, the "id" might be a hash or the username itself
                // Try to find user by jklmUsername matching the nickname
                console.log(`🔍 [JKLM] Searching for user with jklmUsername="${scoreData.nickname}" and isVerified=true`);
                user = await prisma.user.findFirst({
                    where: {
                        isVerified: true,
                        jklmUsername: { equals: scoreData.nickname, mode: 'insensitive' }
                    },
                    include: {
                        categoryMMRs: { where: { category } }
                    }
                });
                if (user) {
                    console.log(`✅ Match par auth JKLM: ${scoreData.nickname} -> ${user.name} (jklmUsername verified)`);
                } else {
                    console.log(`⚠️ [JKLM] No user found with jklmUsername="${scoreData.nickname}"`);
                }
            } else {
                // Chercher l'account avec ce service/ID (Discord, Twitch, etc)
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
        const isWinner = playerStats.placement === 1;
        
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

        // Récupérer le streak actuel pour calculer le nouveau
        const existingCatMMR = await prisma.userCategoryMMR.findUnique({
            where: { userId_category: { userId: user.id, category } }
        });
        const currentStreak = existingCatMMR?.currentStreak || 0;
        const bestStreak = existingCatMMR?.bestStreak || 0;
        const currentMmrPeak = existingCatMMR?.mmrPeak || 1000;
        
        // Calculer le nouveau streak
        const newStreak = isWinner ? currentStreak + 1 : 0;
        const newBestStreak = isWinner ? Math.max(bestStreak, newStreak) : bestStreak;
        
        // Calculer le nouveau MMR et peak
        const currentMmr = existingCatMMR?.mmr || 1000;
        const newMmr = currentMmr + mmrChange;
        const newMmrPeak = Math.max(currentMmrPeak, newMmr);
        
        if (isWinner) {
            console.log(`🔥 ${user.name}: Streak ${currentStreak} -> ${newStreak} (best: ${newBestStreak})`);
        } else if (currentStreak > 0) {
            console.log(`💔 ${user.name}: Streak reset (was ${currentStreak})`);
        }
        
        if (newMmr > currentMmrPeak) {
            console.log(`🏔️ ${user.name}: New MMR Peak! ${currentMmrPeak} -> ${newMmr}`);
        }

        // Mise à jour UserCategoryMMR (MMR + streak par catégorie)
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
                gamesPlayed: 1,
                currentStreak: isWinner ? 1 : 0,
                bestStreak: isWinner ? 1 : 0,
                mmrPeak: Math.max(1000, 1000 + mmrChange)
            },
            update: {
                mmr: { increment: mmrChange },
                gamesPlayed: { increment: 1 },
                currentStreak: newStreak,
                bestStreak: newBestStreak,
                mmrPeak: newMmrPeak
            }
        });
    }

    // 4. Update H2H stats (Rivalries)
    // Compare each pair of players by their points - whoever scored more gets the H2H win
    console.log(`🤝 [H2H] Updating rivalries for ${playersForCalculation.length} players`);
    
    for (let i = 0; i < playersForCalculation.length; i++) {
        for (let j = i + 1; j < playersForCalculation.length; j++) {
            const playerA = playersForCalculation[i];
            const playerB = playersForCalculation[j];
            
            // Determine winner based on score (not placement)
            const aWon = playerA.score > playerB.score;
            const bWon = playerB.score > playerA.score;
            
            // If tied, no H2H update
            if (playerA.score === playerB.score) continue;
            
            const winnerId = aWon ? playerA.id : playerB.id;
            const loserId = aWon ? playerB.id : playerA.id;
            
            // Winner gets +1 win against loser
            await prisma.userMatchup.upsert({
                where: { 
                    userId_opponentId_category: { 
                        userId: winnerId, 
                        opponentId: loserId, 
                        category 
                    } 
                },
                create: { userId: winnerId, opponentId: loserId, category, wins: 1, losses: 0 },
                update: { wins: { increment: 1 }, lastPlayed: new Date() }
            });
            
            // Loser gets +1 loss against winner
            await prisma.userMatchup.upsert({
                where: { 
                    userId_opponentId_category: { 
                        userId: loserId, 
                        opponentId: winnerId, 
                        category 
                    } 
                },
                create: { userId: loserId, opponentId: winnerId, category, wins: 0, losses: 1 },
                update: { losses: { increment: 1 }, lastPlayed: new Date() }
            });
        }
    }
    
    console.log(`✅ [H2H] Updated matchup records for ${playersForCalculation.length} players`);

    // 4. Sauvegarder les réponses (MatchAnswer) et apprendre les questions (PopsauceQuestion)
    const answers = (body as any).answers;
    if (answers && Array.isArray(answers)) {
        console.log(`📝 Traitement de ${answers.length} réponses...`);
        
        // Collecter les questions uniques pour UPSERT
        const uniqueQuestions = new Map<string, {
            prompt: string;
            text: string | null;
            imageHash: string | null;
            correctAnswer: string;
            playerAnswers: string[];
            responseTimes: number[];
        }>();
        
        for (const ans of answers) {
            if (ans.questionHash) {
                const existing = uniqueQuestions.get(ans.questionHash);
                if (existing) {
                    // Agréger les données
                    if (ans.playerAnswer) existing.playerAnswers.push(ans.playerAnswer);
                    if (ans.elapsedTime) existing.responseTimes.push(ans.elapsedTime);
                } else {
                    uniqueQuestions.set(ans.questionHash, {
                        prompt: ans.question,
                        text: ans.questionText || null,
                        imageHash: ans.questionImageHash || null,
                        correctAnswer: ans.answer,
                        playerAnswers: ans.playerAnswer ? [ans.playerAnswer] : [],
                        responseTimes: ans.elapsedTime ? [ans.elapsedTime] : []
                    });
                }
            }
        }
        
        // UPSERT les questions dans PopsauceQuestion
        console.log(`🧠 Apprentissage de ${uniqueQuestions.size} questions uniques...`);
        for (const [hash, data] of uniqueQuestions) {
            try {
                // Calculer le temps moyen de réponse
                const avgTime = data.responseTimes.length > 0 
                    ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length)
                    : null;
                
                // Collecter les alias uniques (réponses joueur différentes de la réponse correcte)
                const normalizedCorrect = data.correctAnswer.toLowerCase().replace(/[^a-z0-9]/g, '');
                const newAliases = [...new Set(
                    data.playerAnswers
                        .map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''))
                        .filter(a => a && a !== normalizedCorrect)
                )];
                
                // Vérifier si la question existe déjà
                const existing = await prisma.popsauceQuestion.findUnique({
                    where: { questionHash: hash }
                });
                
                if (existing) {
                    // UPDATE: Merger les aliases et incrémenter les compteurs
                    const mergedAliases = [...new Set([...existing.aliases, ...newAliases])];
                    await prisma.popsauceQuestion.update({
                        where: { questionHash: hash },
                        data: {
                            timesAsked: { increment: 1 },
                            timesAnswered: { increment: data.responseTimes.length },
                            avgResponseMs: avgTime,
                            aliases: mergedAliases
                        }
                    });
                    console.log(`  ✓ Updated question ${hash.slice(0, 8)}... (asked: ${existing.timesAsked + 1})`);
                } else {
                    // CREATE: Nouvelle question
                    await prisma.popsauceQuestion.create({
                        data: {
                            questionHash: hash,
                            prompt: data.prompt,
                            text: data.text,
                            imageHash: data.imageHash,
                            correctAnswer: data.correctAnswer,
                            aliases: newAliases,
                            timesAsked: 1,
                            timesAnswered: data.responseTimes.length,
                            avgResponseMs: avgTime
                        }
                    });
                    console.log(`  ✓ Created question ${hash.slice(0, 8)}...`);
                }
            } catch (err) {
                console.error(`⚠️ Erreur UPSERT PopsauceQuestion ${hash}:`, err);
            }
        }
        
        // Créer les MatchAnswer avec le questionHash
        const answersData = answers.map((ans: any) => ({
            matchId: match.id,
            userId: nicknameToUser.get(ans.nickname) || null,
            peerId: typeof ans.peerId === 'number' ? ans.peerId : parseInt(ans.peerId) || 0,
            roundIndex: ans.roundIndex,
            question: ans.question,
            questionHash: ans.questionHash || null,
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

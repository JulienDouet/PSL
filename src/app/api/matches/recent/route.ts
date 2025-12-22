import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    // TODO: Ajouter une vérification admin si nécessaire pour voir TOUS les matchs ?
    // Pour l'instant on laisse public comme le leaderboard.

    const matches = await prisma.match.findMany({
        where: {
            status: 'COMPLETED'
        },
        orderBy: {
            endedAt: 'desc'
        },
        take: 50,
        include: {
            matchPlayers: {
                orderBy: {
                    placement: 'asc'
                },
                include: {
                    user: {
                        select: {
                            displayName: true,
                            name: true,
                            image: true
                        }
                    }
                }
            }
        }
    });

    const recentMatches = matches.map(match => {
        const durationSeconds = match.endedAt && match.startedAt 
            ? Math.floor((match.endedAt.getTime() - match.startedAt.getTime()) / 1000)
            : 0;
            
        return {
            id: match.id,
            roomCode: match.lobbyCode,
            category: match.category,
            playerCount: match.matchPlayers.length,
            endedAt: match.endedAt?.toISOString(),
            durationSeconds,
            players: match.matchPlayers.map(mp => ({
                id: mp.userId,
                nickname: mp.user.displayName || mp.user.name || 'Joueur',
                placement: mp.placement,
                mmrChange: mp.mmrChange,
                score: mp.points
            }))
        };
    });

    return NextResponse.json({
        matches: recentMatches
    });

  } catch (err) {
    console.error('Error fetching recent matches:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

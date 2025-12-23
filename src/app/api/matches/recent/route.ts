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

    const matches = await prisma.match.findMany({
        where: {
            status: 'COMPLETED'
        },
        orderBy: {
            endedAt: 'desc'
        },
        take: 50,
        include: {
            players: {
                orderBy: {
                    placement: 'asc'
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            displayName: true,
                            name: true,
                            image: true
                        }
                    }
                }
            }
        }
    });

    // Fetch winner streaks for all winners in one query
    const winnerIds = matches
      .map(m => m.players.find(p => p.placement === 1)?.userId)
      .filter((id): id is string => !!id);
    
    const winnerCategories = matches.map(m => ({
      oderId: m.players.find(p => p.placement === 1)?.userId,
      category: m.category
    }));

    // Batch fetch streaks
    const streakData = await prisma.userCategoryMMR.findMany({
      where: {
        userId: { in: winnerIds }
      },
      select: {
        userId: true,
        category: true,
        currentStreak: true
      }
    });

    // Create lookup map
    const streakMap = new Map<string, number>();
    streakData.forEach(s => {
      streakMap.set(`${s.userId}-${s.category}`, s.currentStreak);
    });

    const recentMatches = matches.map(match => {
        const durationSeconds = match.endedAt && match.startedAt 
            ? Math.floor((match.endedAt.getTime() - match.startedAt.getTime()) / 1000)
            : 0;
        
        // Calculate stats
        const mmrValues = match.players.map(p => p.mmrBefore);
        const avgMmr = mmrValues.length > 0 
          ? Math.round(mmrValues.reduce((sum, v) => sum + v, 0) / mmrValues.length)
          : 0;
        const mmrSpread = mmrValues.length > 1
          ? Math.max(...mmrValues) - Math.min(...mmrValues)
          : 0;
        
        // Detect upset (winner had lower MMR than at least one opponent)
        const winner = match.players.find(p => p.placement === 1);
        const loser = match.players.find(p => p.placement === 2);
        const isUpset = winner && loser && winner.mmrBefore < loser.mmrBefore;
        
        // Get winner's current streak
        const winnerStreak = winner 
          ? streakMap.get(`${winner.userId}-${match.category}`) || 0
          : 0;
            
        return {
            id: match.id,
            roomCode: match.lobbyCode,
            category: match.category,
            playerCount: match.players.length,
            endedAt: match.endedAt?.toISOString(),
            durationSeconds,
            // New stats
            avgMmr,
            mmrSpread,
            isUpset: !!isUpset,
            winnerStreak,
            players: match.players.map(mp => ({
                id: mp.userId,
                nickname: mp.user.displayName || mp.user.name || 'Joueur',
                placement: mp.placement,
                mmrChange: mp.mmrChange,
                mmrBefore: mp.mmrBefore,
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



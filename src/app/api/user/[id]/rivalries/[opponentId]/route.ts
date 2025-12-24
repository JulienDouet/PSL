import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Category } from '@prisma/client';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; opponentId: string }> }
) {
  try {
    const { id, opponentId } = await params;
    const url = new URL(req.url);
    const category = url.searchParams.get('category') as Category | null;

    // Find all matches where both players participated
    const matches = await prisma.match.findMany({
      where: {
        status: 'COMPLETED',
        ...(category && { category }),
        AND: [
          { players: { some: { userId: id } } },
          { players: { some: { userId: opponentId } } }
        ]
      },
      include: {
        players: {
          where: {
            userId: { in: [id, opponentId] }
          },
          select: {
            userId: true,
            points: true,
            placement: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20 // Last 20 matches
    });

    // Format the match history
    const history = matches.map(match => {
      const userPlayer = match.players.find(p => p.userId === id);
      const opponentPlayer = match.players.find(p => p.userId === opponentId);
      
      return {
        matchId: match.id,
        date: match.createdAt,
        category: match.category,
        userPoints: userPlayer?.points ?? 0,
        opponentPoints: opponentPlayer?.points ?? 0,
        userPlacement: userPlayer?.placement,
        opponentPlacement: opponentPlayer?.placement,
        userWon: userPlayer?.placement === 1
      };
    });

    return NextResponse.json({ history });
  } catch (err) {
    console.error('❌ Error fetching match history:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

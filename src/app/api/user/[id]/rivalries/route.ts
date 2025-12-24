import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Category } from '@prisma/client';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const category = url.searchParams.get('category') as Category | null;

    // Fetch all matchups for this user
    const matchups = await prisma.userMatchup.findMany({
      where: { 
        userId: id,
        ...(category && { category })
      },
      include: { 
        opponent: { 
          select: { 
            id: true, 
            name: true, 
            displayName: true, 
            image: true 
          } 
        } 
      },
      orderBy: [
        { wins: 'desc' },
        { losses: 'asc' }
      ]
    });

    // Calculate derived stats
    const enriched = matchups.map(m => ({
      id: m.id,
      category: m.category,
      wins: m.wins,
      losses: m.losses,
      totalGames: m.wins + m.losses,
      winRate: m.wins + m.losses > 0 ? m.wins / (m.wins + m.losses) : 0,
      lastPlayed: m.lastPlayed,
      opponent: {
        id: m.opponent.id,
        name: m.opponent.displayName || m.opponent.name,
        image: m.opponent.image
      }
    }));

    // Find nemesis (worst winrate with 3+ games AND winrate < 50%) 
    // and prey (best winrate with 3+ games AND winrate > 50%)
    const qualified = enriched.filter(m => m.totalGames >= 3);
    const sortedByWinRate = [...qualified].sort((a, b) => a.winRate - b.winRate);
    
    // Nemesis: someone you LOSE against THE MOST (most losses, winrate < 50%)
    const potentialNemesis = qualified
      .filter(m => m.winRate < 0.5)
      .sort((a, b) => b.losses - a.losses);  // Sort by most losses
    const nemesis = potentialNemesis[0] || null;
    
    // Prey: someone you DOMINATE - most WINS among those with winrate > 50%
    const potentialPrey = qualified
      .filter(m => m.winRate > 0.5)
      .sort((a, b) => b.wins - a.wins);  // Sort by most wins
    const prey = potentialPrey[0] || null;

    return NextResponse.json({ 
      matchups: enriched, 
      nemesis, 
      prey,
      totalOpponents: enriched.length,
      qualifiedOpponents: qualified.length  // With 3+ games
    });
  } catch (err) {
    console.error('❌ Error fetching rivalries:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

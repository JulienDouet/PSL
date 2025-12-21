import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RANKS } from '@/lib/mmr';
import type { Category } from '@prisma/client';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = (searchParams.get('category') || 'GP') as Category;
    
    // Récupérer le leaderboard pour cette catégorie via UserCategoryMMR
    const categoryMMRs = await prisma.userCategoryMMR.findMany({
      where: {
        category,
        gamesPlayed: { gt: 0 } // Seulement les joueurs ayant joué dans cette catégorie
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            image: true
          }
        }
      },
      orderBy: {
        mmr: 'desc'
      },
      take: 100
    });

    // Calculer wins/losses pour chaque joueur dans cette catégorie
    const leaderboard = await Promise.all(categoryMMRs.map(async (catMMR, index) => {
      // Compter les victoires (placement = 1) dans les matchs de cette catégorie
      const winsCount = await prisma.matchPlayer.count({
        where: {
          userId: catMMR.userId,
          placement: 1,
          match: {
            category
          }
        }
      });
      
      const totalGames = catMMR.gamesPlayed;
      const rank = RANKS.find(r => catMMR.mmr >= r.min && (r.max === Infinity || catMMR.mmr <= r.max)) || RANKS[0];
      
      return {
        id: catMMR.user.id,
        displayName: catMMR.user.displayName || catMMR.user.name || 'Joueur',
        image: catMMR.user.image,
        mmr: catMMR.mmr,
        gamesPlayed: totalGames,
        wins: winsCount,
        losses: totalGames - winsCount,
        position: index + 1,
        rank: {
          name: rank.name,
          icon: rank.icon
        }
      };
    }));

    return NextResponse.json({
      category,
      leaderboard,
      total: leaderboard.length
    });
  } catch (err) {
    console.error('❌ [API] Leaderboard error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

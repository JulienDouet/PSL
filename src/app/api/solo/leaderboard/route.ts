import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Category, SoloMode } from '@prisma/client';

// Cache for leaderboard (5 min TTL)
const leaderboardCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') as Category || 'GP_FR';
    const mode = searchParams.get('mode') as SoloMode || 'NORMAL';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Validate inputs
    const validCategories: Category[] = ['GP_FR', 'MS_EN', 'ANIME', 'FLAGS', 'NOFILTER_FR', 'NOFILTER_EN'];
    const validModes: SoloMode[] = ['HARDCORE', 'CHALLENGE', 'NORMAL'];

    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    if (!validModes.includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    // Check cache
    const cacheKey = `${category}:${mode}:${limit}`;
    const cached = leaderboardCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Query leaderboard
    const leaderboard = await prisma.soloBestStreak.findMany({
      where: {
        category,
        mode,
        bestStreak: { gt: 0 }
      },
      orderBy: {
        bestStreak: 'desc'
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            image: true
          }
        }
      }
    });

    // Format response
    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      userName: entry.user.displayName || entry.user.name,
      userImage: entry.user.image,
      bestStreak: entry.bestStreak,
      achievedAt: entry.achievedAt
    }));

    const response = {
      category,
      mode,
      leaderboard: formattedLeaderboard,
      total: formattedLeaderboard.length,
      cachedAt: new Date().toISOString()
    };

    // Update cache
    leaderboardCache.set(cacheKey, { data: response, ts: Date.now() });

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [SOLO] Leaderboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

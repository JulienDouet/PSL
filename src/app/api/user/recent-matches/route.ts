import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recentMatches = await prisma.matchPlayer.findMany({
      where: { userId: session.user.id },
      include: { match: true },
      orderBy: { match: { createdAt: 'desc' } },
      take: 5,
    });

    const matches = recentMatches.map(mp => ({
      id: mp.id,
      placement: mp.placement,
      points: mp.points,
      mmrChange: mp.mmrChange,
      match: {
        category: mp.match.category,
      }
    }));

    return NextResponse.json({ matches });
  } catch (err) {
    console.error('❌ [API] Error fetching recent matches:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

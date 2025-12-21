import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categoryMMRs = await prisma.userCategoryMMR.findMany({
      where: { userId: session.user.id },
      orderBy: { gamesPlayed: 'desc' }
    });

    return NextResponse.json({
      categoryMMRs: categoryMMRs.map(c => ({
        category: c.category,
        mmr: c.mmr,
        gamesPlayed: c.gamesPlayed
      }))
    });
  } catch (err) {
    console.error('❌ [API] Error getting category MMRs:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

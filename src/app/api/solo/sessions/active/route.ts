import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

// GET: Fetch all active solo sessions (admin only)
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });
    
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all active solo sessions with user info
    const activeSessions = await prisma.soloSession.findMany({
      where: {
        status: 'IN_PROGRESS'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        startedAt: 'desc'
      }
    });

    return NextResponse.json({
      sessions: activeSessions.map(s => ({
        id: s.id,
        category: s.category,
        mode: s.mode,
        roomCode: s.roomCode,
        streak: s.streak,
        bestStreak: s.bestStreak,
        startedAt: s.startedAt.toISOString(),
        user: {
          id: s.user.id,
          name: s.user.name || 'Anonymous'
        }
      }))
    });

  } catch (error) {
    console.error('❌ [SOLO] Active sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

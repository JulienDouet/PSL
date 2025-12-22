import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user/latest-result
 * Retourne le dernier résultat de match de l'utilisateur connecté.
 * Utilisé pour afficher l'écran post-match avec le changement de MMR.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Récupérer le dernier match de l'utilisateur
    const latestMatchPlayer = await prisma.matchPlayer.findFirst({
      where: { userId: session.user.id },
      orderBy: { match: { createdAt: 'desc' } },
      include: {
        match: {
          select: {
            id: true,
            category: true,
            createdAt: true,
            _count: {
              select: { players: true }
            }
          }
        }
      }
    });

    if (!latestMatchPlayer) {
      return NextResponse.json({ result: null });
    }

    // Vérifier si le match est récent (< 10 minutes)
    const matchAge = Date.now() - latestMatchPlayer.match.createdAt.getTime();
    const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

    if (matchAge > MAX_AGE_MS) {
      return NextResponse.json({ result: null });
    }

    // Construire la réponse
    const result = {
      matchId: latestMatchPlayer.match.id,
      placement: latestMatchPlayer.placement,
      playersCount: latestMatchPlayer.match._count.players,
      mmrBefore: latestMatchPlayer.mmrBefore,
      mmrAfter: latestMatchPlayer.mmrAfter,
      mmrChange: latestMatchPlayer.mmrChange,
      category: latestMatchPlayer.match.category,
      createdAt: latestMatchPlayer.match.createdAt.toISOString(),
    };

    return NextResponse.json({ result });
  } catch (err) {
    console.error('❌ [API] Error fetching latest result:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

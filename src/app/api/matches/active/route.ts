import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAllActiveMatches } from '@/lib/queue';

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Vérifier si l'utilisateur est admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    // Tout le monde peut voir les matchs actifs (utile pour les joueurs aussi)
    // Mais le kill sera réservé aux admins
    
    const matches = getAllActiveMatches();
    
    // Formatter les données pour l'affichage
    const formattedMatches = matches.map(match => ({
      roomCode: match.roomCode,
      category: match.category,
      playerCount: match.players.length,
      players: match.players.map(p => ({
        nickname: p.nickname,
        mmr: p.mmr
      })),
      createdAt: match.createdAt.toISOString(),
      durationSeconds: Math.floor((Date.now() - match.createdAt.getTime()) / 1000),
      botPid: user?.isAdmin ? match.botPid : undefined // Seulement visible pour les admins
    }));

    return NextResponse.json({
      matches: formattedMatches,
      isAdmin: user?.isAdmin || false
    });
  } catch (err) {
    console.error('❌ [MATCHES] Error getting active matches:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

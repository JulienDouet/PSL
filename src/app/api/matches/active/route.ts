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

    // Vérifier si l'utilisateur est admin (seulement si connecté)
    let isAdmin = false;
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true }
      });
      isAdmin = user?.isAdmin || false;
    }

    // Tout le monde peut voir les matchs actifs (même sans connexion)
    
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
      botPid: isAdmin ? match.botPid : undefined // Seulement visible pour les admins
    }));

    return NextResponse.json({
      matches: formattedMatches,
      isAdmin
    });
  } catch (err) {
    console.error('❌ [MATCHES] Error getting active matches:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

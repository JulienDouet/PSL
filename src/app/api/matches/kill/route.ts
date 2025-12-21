import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { killMatch } from '@/lib/queue';

export async function POST(request: NextRequest) {
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

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { roomCode } = body;

    if (!roomCode) {
      return NextResponse.json({ error: 'roomCode is required' }, { status: 400 });
    }

    // Tuer le match
    const result = killMatch(roomCode);

    if (!result.success) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Si on a un PID de bot, tenter de le tuer
    if (result.botPid) {
      try {
        process.kill(result.botPid, 'SIGTERM');
        console.log(`🔪 [ADMIN] Bot process ${result.botPid} killed`);
      } catch (killErr) {
        // Le processus n'existe peut-être plus
        console.log(`⚠️ [ADMIN] Could not kill bot process ${result.botPid}:`, killErr);
      }
    }

    return NextResponse.json({
      success: true,
      roomCode,
      botPid: result.botPid,
      message: `Match ${roomCode} killed successfully`
    });
  } catch (err) {
    console.error('❌ [MATCHES] Error killing match:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

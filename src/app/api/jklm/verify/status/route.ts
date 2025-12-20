import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Récupérer l'utilisateur avec son jklmUsername actuel
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        jklmUsername: true,
        isVerified: true
      }
    });

    // Vérifier s'il y a une vérification en cours
    const pendingVerification = await prisma.jKLMVerification.findUnique({
      where: { userId: session.user.id }
    });

    if (user?.jklmUsername && user.isVerified) {
      return NextResponse.json({
        status: 'verified',
        jklmUsername: user.jklmUsername
      });
    }

    if (pendingVerification) {
      // Vérifier si elle n'a pas expiré
      if (pendingVerification.expiresAt < new Date()) {
        await prisma.jKLMVerification.delete({ where: { userId: session.user.id } });
        return NextResponse.json({ status: 'none' });
      }

      return NextResponse.json({
        status: 'pending',
        code: pendingVerification.code,
        roomCode: pendingVerification.roomCode,
        roomUrl: `https://jklm.fun/${pendingVerification.roomCode}`,
        jklmUsername: pendingVerification.jklmUsername,
        expiresAt: pendingVerification.expiresAt.toISOString()
      });
    }

    return NextResponse.json({ status: 'none' });

  } catch (err) {
    console.error('❌ [VERIFY] Status error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

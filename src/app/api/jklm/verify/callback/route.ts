import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, nickname, roomCode } = body;

    if (!code || !nickname) {
      return NextResponse.json({ error: 'Missing code or nickname' }, { status: 400 });
    }

    console.log(`🔐 [VERIFY] Callback reçu: code=${code}, nickname=${nickname}, room=${roomCode}`);

    // Trouver la vérification correspondante
    const verification = await prisma.jKLMVerification.findUnique({
      where: { code },
      include: { user: true }
    });

    if (!verification) {
      console.log(`❌ [VERIFY] Code ${code} non trouvé`);
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Vérifier l'expiration
    if (verification.expiresAt < new Date()) {
      console.log(`❌ [VERIFY] Code ${code} expiré`);
      await prisma.jKLMVerification.delete({ where: { code } });
      return NextResponse.json({ error: 'Code expired' }, { status: 410 });
    }

    // Vérifier que le pseudo correspond (case-insensitive)
    if (verification.jklmUsername.toLowerCase() !== nickname.toLowerCase()) {
      console.log(`❌ [VERIFY] Pseudo ne correspond pas: attendu=${verification.jklmUsername}, reçu=${nickname}`);
      return NextResponse.json({ 
        error: 'Nickname mismatch',
        expected: verification.jklmUsername,
        received: nickname
      }, { status: 403 });
    }

    // Tout est OK ! Mettre à jour l'utilisateur
    await prisma.user.update({
      where: { id: verification.userId },
      data: {
        jklmUsername: verification.jklmUsername,
        isVerified: true
      }
    });

    // Supprimer la vérification
    await prisma.jKLMVerification.delete({ where: { code } });

    console.log(`✅ [VERIFY] ${verification.jklmUsername} vérifié pour user ${verification.userId}`);

    return NextResponse.json({ 
      success: true,
      jklmUsername: verification.jklmUsername
    });

  } catch (err) {
    console.error('❌ [VERIFY] Callback error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

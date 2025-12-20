import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { spawn } from 'child_process';
import path from 'path';

// Génère un code de vérification unique
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Évite I, O, 0, 1 pour éviter la confusion
  let code = 'PSL-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { jklmUsername } = body;

    if (!jklmUsername || jklmUsername.length < 2 || jklmUsername.length > 20) {
      return NextResponse.json({ error: 'Invalid JKLM username' }, { status: 400 });
    }

    // Vérifier si ce pseudo JKLM est déjà pris par un autre utilisateur
    const existingUser = await prisma.user.findFirst({
      where: {
        jklmUsername: { equals: jklmUsername, mode: 'insensitive' },
        id: { not: session.user.id }
      }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Ce pseudo JKLM est déjà lié à un autre compte' }, { status: 409 });
    }

    // Supprimer une éventuelle vérification existante
    await prisma.jKLMVerification.deleteMany({
      where: { userId: session.user.id }
    });

    // Générer un nouveau code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Créer une room JKLM pour la vérification
    console.log('🔐 [VERIFY] Création de la room de vérification...');
    const roomCode = await createVerificationRoom(code);

    if (!roomCode) {
      return NextResponse.json({ error: 'Impossible de créer la room de vérification' }, { status: 500 });
    }

    // Sauvegarder la vérification
    await prisma.jKLMVerification.create({
      data: {
        userId: session.user.id,
        jklmUsername,
        code,
        roomCode,
        expiresAt
      }
    });

    console.log(`🔐 [VERIFY] Code ${code} généré pour ${jklmUsername} (room: ${roomCode})`);

    return NextResponse.json({
      code,
      roomCode,
      roomUrl: `https://jklm.fun/${roomCode}`,
      expiresAt: expiresAt.toISOString()
    });

  } catch (err) {
    console.error('❌ [VERIFY] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function createVerificationRoom(verificationCode: string): Promise<string | null> {
  return new Promise((resolve) => {
    const botScript = path.join(process.cwd(), 'jklm-bot/index.js');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/api/jklm/verify/callback`;

    const isDev = process.env.NODE_ENV === 'development';
    let isDetached = !isDev;
    if (process.env.BOT_DETACHED !== undefined) {
      isDetached = process.env.BOT_DETACHED === 'true';
    }

    const child = spawn('node', [
      botScript,
      '--create',
      '--verify-mode',
      verificationCode,
      callbackUrl
    ], {
      detached: isDetached,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    const timeout = setTimeout(() => {
      console.log('⏰ [VERIFY] Timeout waiting for room code');
      resolve(null);
    }, 20000);

    child.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[VERIFY-BOT] ${output.trim()}`);
      const match = output.match(/Room cr..?e: ([A-Z]{4})/i);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`[VERIFY-BOT ERR] ${data.toString()}`);
    });

    if (isDetached) {
      child.unref(); // Only detach if explicitly requested or in production
    }
  });
}

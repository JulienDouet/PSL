import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import type { Category, SoloMode } from '@prisma/client';

// Solo bot connection (runs in same process for now)
// TODO: Move to separate service if needed

// In-memory session tracking (for MVP)
// In production, this would be managed by the solo-bot service
const pendingSessions = new Map<string, {
  userId: string;
  category: Category;
  mode: SoloMode;
  createdAt: Date;
}>();

export async function POST(req: Request) {
  try {
    // Auth check
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { category, mode } = body;

    // Validate inputs
    const validCategories: Category[] = ['GP_FR', 'MS_EN', 'ANIME', 'FLAGS', 'NOFILTER_FR', 'NOFILTER_EN'];
    const validModes: SoloMode[] = ['HARDCORE', 'CHALLENGE', 'NORMAL'];

    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    if (!validModes.includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    // Check if user already has an active session
    const existingSession = await prisma.soloSession.findFirst({
      where: {
        userId: session.user.id,
        status: 'IN_PROGRESS'
      }
    });

    if (existingSession) {
      return NextResponse.json({
        error: 'You already have an active session',
        existingSession: {
          id: existingSession.id,
          roomCode: existingSession.roomCode,
          streak: existingSession.streak
        }
      }, { status: 409 });
    }

    // Create session in DB
    const soloSession = await prisma.soloSession.create({
      data: {
        userId: session.user.id,
        category,
        mode,
        status: 'IN_PROGRESS'
      }
    });

    console.log(`🎯 [SOLO] Created session ${soloSession.id} for user ${session.user.id}`);

    // TODO: Trigger solo-bot to create JKLM room
    // For now, return session info and let frontend handle bot connection
    // In production, this would spawn a bot instance or add to queue

    // Get callback URL from environment
    const callbackUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://psl-ranked.app';

    return NextResponse.json({
      success: true,
      session: {
        id: soloSession.id,
        category,
        mode,
        status: 'IN_PROGRESS'
      },
      // Room will be created by solo-bot
      // For MVP: direct user to wait while bot starts
      message: 'Session created. Connecting to game server...',
      callbackUrl
    });

  } catch (error) {
    console.error('❌ [SOLO] Start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Check if user has active session
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeSession = await prisma.soloSession.findFirst({
      where: {
        userId: session.user.id,
        status: 'IN_PROGRESS'
      }
    });

    if (!activeSession) {
      return NextResponse.json({ active: false });
    }

    return NextResponse.json({
      active: true,
      session: {
        id: activeSession.id,
        category: activeSession.category,
        mode: activeSession.mode,
        streak: activeSession.streak,
        bestStreak: activeSession.bestStreak,
        roomCode: activeSession.roomCode,
        startedAt: activeSession.startedAt
      }
    });

  } catch (error) {
    console.error('❌ [SOLO] Status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

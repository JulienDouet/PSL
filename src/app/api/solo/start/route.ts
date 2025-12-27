import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { spawn } from 'child_process';
import path from 'path';

// In-memory map to store session-to-PID mapping for bot cleanup
// Key: sessionId, Value: botPid
export const sessionBotPids = new Map<string, number>();

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

    // Admin check - Solo Mode is admin-only during beta
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Solo Mode is admin-only during beta' }, { status: 403 });
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

    // Get callback URL from environment
    const callbackUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://psl-ranked.app';

    
    const isDev = process.env.NODE_ENV === 'development';
    let isDetached = !isDev;
    if (process.env.BOT_DETACHED !== undefined) {
      isDetached = process.env.BOT_DETACHED === 'true';
    }

    console.log(`🚀 [SOLO] Spawning bot for session ${soloSession.id}`);

    // Use index.js (which works!) with --solo-mode flag instead of solo-bot.js
    const botScript = path.join(process.cwd(), 'jklm-bot/index.js');
    
    const child = spawn('node', [
      botScript,
      '--create',           // Create room automatically
      '--solo-mode',        // Enable solo-specific behavior
      '--session', soloSession.id,
      '--user', session.user.id,
      '--category', category,
      '--mode', mode,       // HARDCORE / CHALLENGE / NORMAL
      callbackUrl           // Callback URL for room_created notification
    ], {
      detached: isDetached,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    const botPid = child.pid;
    console.log(`🤖 [SOLO] Bot spawned with PID: ${botPid}`);

    // Store PID for cleanup on session end
    if (botPid) {
      sessionBotPids.set(soloSession.id, botPid);
      console.log(`📋 [SOLO] Stored PID ${botPid} for session ${soloSession.id}`);
    }

    // Clean up PID from map when process exits
    child.on('exit', (code, signal) => {
      console.log(`🛑 [SOLO] Bot process exited: code=${code}, signal=${signal}`);
      sessionBotPids.delete(soloSession.id);
    });

    // Log stdout/stderr
    child.stdout.on('data', (data) => {
      console.log(`[SOLO-BOT] ${data.toString().trim()}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`[SOLO-BOT ERR] ${data.toString().trim()}`);
    });

    if (isDetached) {
      child.unref();
    }

    // Return immediately - bot will notify via callback when room is ready
    return NextResponse.json({
      success: true,
      session: {
        id: soloSession.id,
        category,
        mode,
        status: 'IN_PROGRESS'
      },
      message: 'Session created. Bot is creating room...',
      callbackUrl
    });

  } catch (error) {
    console.error('❌ [SOLO] Start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Check if user has active session (admin only)
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check - Solo Mode is admin-only during beta
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Solo Mode is admin-only during beta' }, { status: 403 });
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

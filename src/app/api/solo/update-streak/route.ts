import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/solo/update-streak
 * Called by the bot to update the streak in the SoloSession
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, streak, bestStreak } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    // Update the session with current streak values
    const updated = await prisma.soloSession.update({
      where: { id: sessionId },
      data: {
        streak: streak || 0,
        bestStreak: bestStreak || 0
      }
    });

    console.log(`📊 [SOLO] Updated streak for session ${sessionId}: streak=${streak}, bestStreak=${bestStreak}`);

    return NextResponse.json({ success: true, updated: { streak: updated.streak, bestStreak: updated.bestStreak } });
  } catch (err: any) {
    console.error('Error updating streak:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

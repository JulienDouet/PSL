import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { SoloStatus } from '@prisma/client';

/**
 * Callback endpoint for solo-bot to update session state
 * Called by the bot for:
 * - state_update: periodic streak/question updates
 * - session_end: when session ends (timeout, user left, etc.)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // Find session
    const session = await prisma.soloSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (type === 'state_update') {
      // Periodic state update from bot
      const { streak, bestStreak, questionsAsked, roomCode } = body;

      const updateData: any = {
        lastActivityAt: new Date()
      };

      if (streak !== undefined) updateData.streak = streak;
      if (bestStreak !== undefined && bestStreak > session.bestStreak) {
        updateData.bestStreak = bestStreak;
      }
      if (questionsAsked !== undefined) updateData.questionsAsked = questionsAsked;
      if (roomCode && !session.roomCode) updateData.roomCode = roomCode;

      await prisma.soloSession.update({
        where: { id: sessionId },
        data: updateData
      });

      console.log(`📊 [SOLO] State update ${sessionId}: streak=${streak}, best=${bestStreak}`);

      return NextResponse.json({ success: true });

    } else if (type === 'session_end') {
      // Session ended (from bot)
      const { streak, bestStreak, questionsAsked, reason, duration } = body;

      // Map reason to status
      const statusMap: Record<string, SoloStatus> = {
        'COMPLETED': 'COMPLETED',
        'TIMEOUT': 'TIMEOUT',
        'ABANDONED': 'ABANDONED',
        'DISCONNECT': 'ABANDONED'
      };
      const finalStatus: SoloStatus = statusMap[reason] || 'COMPLETED';

      // Update session
      await prisma.soloSession.update({
        where: { id: sessionId },
        data: {
          status: finalStatus,
          streak: streak ?? session.streak,
          bestStreak: Math.max(bestStreak ?? 0, session.bestStreak),
          questionsAsked: questionsAsked ?? session.questionsAsked,
          endedAt: new Date()
        }
      });

      // Update best streak leaderboard
      const finalBestStreak = Math.max(bestStreak ?? 0, session.bestStreak);
      if (finalBestStreak > 0) {
        const existingBest = await prisma.soloBestStreak.findUnique({
          where: {
            userId_category_mode: {
              userId: session.userId,
              category: session.category,
              mode: session.mode
            }
          }
        });

        if (!existingBest || finalBestStreak > existingBest.bestStreak) {
          await prisma.soloBestStreak.upsert({
            where: {
              userId_category_mode: {
                userId: session.userId,
                category: session.category,
                mode: session.mode
              }
            },
            create: {
              userId: session.userId,
              category: session.category,
              mode: session.mode,
              bestStreak: finalBestStreak,
              achievedAt: new Date()
            },
            update: {
              bestStreak: finalBestStreak,
              achievedAt: new Date()
            }
          });
        }
      }

      console.log(`🏁 [SOLO] Session ${sessionId} ended via callback: ${reason} | Best: ${finalBestStreak}`);

      return NextResponse.json({ success: true });

    } else {
      return NextResponse.json({ error: 'Unknown callback type' }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [SOLO] Callback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

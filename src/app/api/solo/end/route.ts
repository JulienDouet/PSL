import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    // Auth check
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, reason } = body;

    // Find the session
    const soloSession = await prisma.soloSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
        status: 'IN_PROGRESS'
      }
    });

    if (!soloSession) {
      return NextResponse.json({ error: 'Session not found or already ended' }, { status: 404 });
    }

    // Determine final status
    const finalStatus = reason === 'TIMEOUT' ? 'TIMEOUT' : 
                        reason === 'ABANDONED' ? 'ABANDONED' : 'COMPLETED';

    // Update session
    const updatedSession = await prisma.soloSession.update({
      where: { id: sessionId },
      data: {
        status: finalStatus,
        endedAt: new Date()
      }
    });

    // Update best streak if new record
    if (soloSession.bestStreak > 0) {
      await prisma.soloBestStreak.upsert({
        where: {
          userId_category_mode: {
            userId: session.user.id,
            category: soloSession.category,
            mode: soloSession.mode
          }
        },
        create: {
          userId: session.user.id,
          category: soloSession.category,
          mode: soloSession.mode,
          bestStreak: soloSession.bestStreak,
          achievedAt: new Date()
        },
        update: {
          bestStreak: {
            // Only update if new record is better
            set: soloSession.bestStreak
          },
          achievedAt: new Date()
        }
      });

      // Check if this is actually a new record
      const existingBest = await prisma.soloBestStreak.findUnique({
        where: {
          userId_category_mode: {
            userId: session.user.id,
            category: soloSession.category,
            mode: soloSession.mode
          }
        }
      });

      if (existingBest && soloSession.bestStreak > existingBest.bestStreak) {
        // Actually update with higher value
        await prisma.soloBestStreak.update({
          where: {
            userId_category_mode: {
              userId: session.user.id,
              category: soloSession.category,
              mode: soloSession.mode
            }
          },
          data: {
            bestStreak: soloSession.bestStreak,
            achievedAt: new Date()
          }
        });
      }
    }

    console.log(`🏁 [SOLO] Session ${sessionId} ended: ${finalStatus} | Best streak: ${soloSession.bestStreak}`);

    return NextResponse.json({
      success: true,
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        streak: updatedSession.streak,
        bestStreak: updatedSession.bestStreak,
        questionsAsked: updatedSession.questionsAsked,
        duration: updatedSession.endedAt 
          ? updatedSession.endedAt.getTime() - updatedSession.startedAt.getTime() 
          : 0
      }
    });

  } catch (error) {
    console.error('❌ [SOLO] End error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

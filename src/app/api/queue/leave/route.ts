import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { leaveQueue, getQueueStatus } from '@/lib/queue';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if player was in lobby (countdown active = other players visible)
    const status = getQueueStatus(session.user.id);
    const wasInLobby = status.countdown !== null && status.countdown < 30; // Countdown started = lobby
    const category = status.category;

    const success = leaveQueue(session.user.id);

    // Anti-dodge: Reset streak if cancelled while in lobby
    let streakReset = false;
    if (wasInLobby && category) {
      try {
        const catMMR = await prisma.userCategoryMMR.findUnique({
          where: { userId_category: { userId: session.user.id, category } }
        });
        
        if (catMMR && catMMR.currentStreak > 0) {
          await prisma.userCategoryMMR.update({
            where: { userId_category: { userId: session.user.id, category } },
            data: { currentStreak: 0 }
          });
          streakReset = true;
          console.log(`🔄 [ANTI-DODGE] Streak reset for ${session.user.id} in ${category} (cancelled in lobby, was ${catMMR.currentStreak})`);
        }
      } catch (err) {
        console.error('Error resetting streak:', err);
      }
    }

    return NextResponse.json({ success, streakReset });
  } catch (err) {
    console.error('❌ [QUEUE] Error leaving:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

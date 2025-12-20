import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getQueueStatus, getQueueCounts } from '@/lib/queue';

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const status = getQueueStatus(session.user.id);
    const counts = getQueueCounts();

    return NextResponse.json({
      ...status,
      queueCounts: counts
    });
  } catch (err) {
    console.error('❌ [QUEUE] Error getting status:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

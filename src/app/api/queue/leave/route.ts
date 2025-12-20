import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { leaveQueue } from '@/lib/queue';

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const success = leaveQueue(session.user.id);

    return NextResponse.json({ success });
  } catch (err) {
    console.error('❌ [QUEUE] Error leaving:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

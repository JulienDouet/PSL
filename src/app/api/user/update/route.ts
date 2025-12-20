import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { displayName } = body;

    if (!displayName || displayName.length < 2 || displayName.length > 30) {
      return NextResponse.json({ error: 'Invalid display name (2-30 chars)' }, { status: 400 });
    }

    // Mettre à jour l'utilisateur
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { displayName },
      select: { displayName: true }
    });

    return NextResponse.json({ success: true, displayName: updated.displayName });

  } catch (err) {
    console.error('❌ Error updating user:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

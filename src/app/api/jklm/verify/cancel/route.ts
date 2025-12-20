import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Supprimer la vérification en attente
    await prisma.jKLMVerification.deleteMany({
      where: { userId: session.user.id }
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('❌ [VERIFY] Cancel error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

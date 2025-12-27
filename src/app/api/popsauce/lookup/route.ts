import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/popsauce/lookup
 * Look up a question by its hash and return the answer if known
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { questionHash } = body;

    if (!questionHash) {
      return NextResponse.json({ error: 'Missing questionHash' }, { status: 400 });
    }

    const question = await prisma.popsauceQuestion.findUnique({
      where: { questionHash },
      select: {
        correctAnswer: true,
        aliases: true,
        timesAsked: true
      }
    });

    if (!question || !question.correctAnswer) {
      // Question not found or no known answer
      return NextResponse.json({ found: false });
    }

    // Increment timesAsked counter (fire and forget)
    prisma.popsauceQuestion.update({
      where: { questionHash },
      data: { timesAsked: { increment: 1 } }
    }).catch(() => {}); // Ignore errors

    return NextResponse.json({
      found: true,
      answer: question.correctAnswer,
      aliases: question.aliases
    });

  } catch (error) {
    console.error('❌ [POPSAUCE] Lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/popsauce/learn
 * Save or update a question's answer from game data
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { questionHash, prompt, text, imageHash, correctAnswer } = body;

    if (!questionHash || !prompt || !correctAnswer) {
      return NextResponse.json(
        { error: 'Missing required fields: questionHash, prompt, correctAnswer' },
        { status: 400 }
      );
    }

    // Upsert: create if not exists, update if exists
    const question = await prisma.popsauceQuestion.upsert({
      where: { questionHash },
      create: {
        questionHash,
        prompt,
        text: text || null,
        imageHash: imageHash || null,
        correctAnswer,
        timesAsked: 1,
        timesAnswered: 1
      },
      update: {
        // Only update correctAnswer if we have a new one and didn't have one before
        // or if the new one is different (edge case)
        correctAnswer: correctAnswer,
        timesAsked: { increment: 1 },
        timesAnswered: { increment: 1 }
      }
    });

    console.log(`📚 [POPSAUCE] Learned/updated question: ${prompt.substring(0, 30)}... -> ${correctAnswer}`);

    return NextResponse.json({
      success: true,
      questionId: question.id,
      isNew: question.createdAt.getTime() === question.updatedAt.getTime()
    });

  } catch (error) {
    console.error('❌ [POPSAUCE] Learn error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

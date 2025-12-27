import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/solo/record-answer
 * Called by the bot to record a solo answer for speed leaderboard
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      sessionId, 
      userId, 
      questionHash, 
      question, 
      answer, 
      playerAnswer, 
      elapsedTime,
      peerId,
      roundIndex 
    } = body;

    if (!userId || !elapsedTime) {
      return NextResponse.json({ error: 'userId and elapsedTime required' }, { status: 400 });
    }

    // Normalize the player answer for comparison
    const normalizedAnswer = playerAnswer?.toLowerCase().replace(/[^a-z0-9]/g, '') || null;

    // Create the MatchAnswer with source: SOLO
    const matchAnswer = await prisma.matchAnswer.create({
      data: {
        matchId: null, // No match for solo mode
        userId,
        peerId: peerId || 0,
        roundIndex: roundIndex || 0,
        question: question || '',
        questionHash: questionHash || null,
        answer: answer || '',
        playerAnswer: normalizedAnswer,
        elapsedTime,
        source: 'SOLO'
      }
    });

    console.log(`📊 [SOLO] Recorded answer: ${playerAnswer} in ${elapsedTime}ms for user ${userId}`);

    return NextResponse.json({ 
      success: true, 
      id: matchAnswer.id,
      elapsedTime: matchAnswer.elapsedTime 
    });
  } catch (err: any) {
    console.error('Error recording solo answer:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

'use server';

import { prisma } from "@/lib/prisma";

export interface SpeedRecord {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  time: number; // ms
  answer: string;
  createdAt: Date;
}

export async function getSpeedRecords(userAnswer: string): Promise<SpeedRecord[]> {
  if (!userAnswer || userAnswer.trim().length < 2) {
    return [];
  }

  // Normalisation recherche
  const normalizedAnswer = userAnswer.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const records = await prisma.matchAnswer.findMany({
    where: {
      playerAnswer: normalizedAnswer,
      userId: { not: null } // Uniquement les joueurs enregistrés
    },
    orderBy: {
      elapsedTime: 'asc'
    },
    take: 50,
    include: {
        user: true
    }
  });

  return records.map(r => ({
    id: r.id,
    userId: r.userId!,
    userName: r.user?.name || r.user?.displayName || 'Inconnu',
    userImage: r.user?.image || null,
    time: r.elapsedTime,
    answer: r.answer, // La réponse "officielle" du jeu
    createdAt: r.createdAt
  }));
}

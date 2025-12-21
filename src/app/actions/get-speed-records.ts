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

export async function getSpeedRecords(options?: { query?: string, length?: number }): Promise<SpeedRecord[]> {
  const { query, length } = options || {};

  // 1. Recherche Textuelle (si query présent)
  if (query && query.trim().length > 0) {
    const normalizedAnswer = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const records = await prisma.matchAnswer.findMany({
      where: {
        playerAnswer: normalizedAnswer,
        userId: { not: null }
      },
      orderBy: { elapsedTime: 'asc' },
      take: 50,
      include: { user: true }
    });
    return mapRecords(records);
  }

  // 2. Filtre par taille (si length présent)
  if (length && length > 0) {
    // Note: Utilisation de queryRaw car Prisma n'a pas de filtre nativement sur la longueur de string
    // On s'assure que la table s'appelle bien MatchAnswer (convention Prisma default)
    // SQLite/Postgres supportent LENGTH() ou LEN(). On assume un standard SQL ici.
    const records = await prisma.$queryRaw<any[]>`
      SELECT ma.*, u.name as "userName", u.image as "userImage", u."displayName" as "userDisplayName"
      FROM "MatchAnswer" ma
      LEFT JOIN "User" u ON ma."userId" = u.id
      WHERE ma."userId" IS NOT NULL
      AND LENGTH(ma."playerAnswer") = ${length}
      ORDER BY ma."elapsedTime" ASC
      LIMIT 50
    `;
    
    // Mapping manuel car le retour raw est différent structurellement (flat)
    return records.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userDisplayName || r.userName || 'Inconnu',
      userImage: r.userImage || null,
      time: r.elapsedTime,
      answer: r.answer,
      createdAt: new Date(r.createdAt)
    }));
  }

  // 3. Par défaut (Top 50 Global)
  // On prend les 50 meilleurs temps toutes réponses confondues
  const records = await prisma.matchAnswer.findMany({
    where: { userId: { not: null } },
    orderBy: { elapsedTime: 'asc' },
    take: 50,
    include: { user: true }
  });
  return mapRecords(records);
}

function mapRecords(records: any[]): SpeedRecord[] {
  return records.map(r => ({
    id: r.id,
    userId: r.userId!,
    userName: r.user?.name || r.user?.displayName || 'Inconnu',
    userImage: r.user?.image || null,
    time: r.elapsedTime,
    answer: r.answer, 
    createdAt: r.createdAt
  }));
}

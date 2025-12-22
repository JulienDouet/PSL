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
    
    // Utilisation d'une sous-requête pour garder le meilleur temps par user+answer
    const records = await prisma.$queryRaw<any[]>`
      SELECT ma.*, u.name as "userName", u.image as "userImage", u."displayName" as "userDisplayName"
      FROM "MatchAnswer" ma
      LEFT JOIN "User" u ON ma."userId" = u.id
      WHERE ma."userId" IS NOT NULL
      AND ma."playerAnswer" = ${normalizedAnswer}
      AND ma."elapsedTime" = (
        SELECT MIN(ma2."elapsedTime")
        FROM "MatchAnswer" ma2
        WHERE ma2."userId" = ma."userId"
        AND ma2."playerAnswer" = ma."playerAnswer"
      )
      ORDER BY ma."elapsedTime" ASC
      LIMIT 50
    `;
    
    return records.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userDisplayName || r.userName || 'Inconnu',
      userImage: r.userImage || null,
      time: r.elapsedTime,
      answer: r.playerAnswer,
      createdAt: new Date(r.createdAt)
    }));
  }

  // 2. Filtre par taille (si length présent)
  if (length && length > 0) {
    const records = await prisma.$queryRaw<any[]>`
      SELECT ma.*, u.name as "userName", u.image as "userImage", u."displayName" as "userDisplayName"
      FROM "MatchAnswer" ma
      LEFT JOIN "User" u ON ma."userId" = u.id
      WHERE ma."userId" IS NOT NULL
      AND ma."playerAnswer" IS NOT NULL
      AND LENGTH(ma."playerAnswer") = ${length}
      AND ma."elapsedTime" = (
        SELECT MIN(ma2."elapsedTime")
        FROM "MatchAnswer" ma2
        WHERE ma2."userId" = ma."userId"
        AND ma2."playerAnswer" = ma."playerAnswer"
      )
      ORDER BY ma."elapsedTime" ASC
      LIMIT 50
    `;
    
    return records.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userDisplayName || r.userName || 'Inconnu',
      userImage: r.userImage || null,
      time: r.elapsedTime,
      answer: r.playerAnswer,
      createdAt: new Date(r.createdAt)
    }));
  }

  // 3. Par défaut (Top 50 Global) - meilleur temps par user+answer
  const records = await prisma.$queryRaw<any[]>`
    SELECT ma.*, u.name as "userName", u.image as "userImage", u."displayName" as "userDisplayName"
    FROM "MatchAnswer" ma
    LEFT JOIN "User" u ON ma."userId" = u.id
    WHERE ma."userId" IS NOT NULL
    AND ma."playerAnswer" IS NOT NULL
    AND ma."elapsedTime" = (
      SELECT MIN(ma2."elapsedTime")
      FROM "MatchAnswer" ma2
      WHERE ma2."userId" = ma."userId"
      AND ma2."playerAnswer" = ma."playerAnswer"
    )
    ORDER BY ma."elapsedTime" ASC
    LIMIT 50
  `;
  
  return records.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    userName: r.userDisplayName || r.userName || 'Inconnu',
    userImage: r.userImage || null,
    time: r.elapsedTime,
    answer: r.playerAnswer,
    createdAt: new Date(r.createdAt)
  }));
}


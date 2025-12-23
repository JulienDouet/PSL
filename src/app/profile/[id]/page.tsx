import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/navbar";

import { CategoryStats } from "@/components/profile/category-stats";
import { ProfileHeader } from "@/components/profile/profile-header";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;

  // Récupérer l'utilisateur avec ses MMR par catégorie et matchs
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      categoryMMRs: true,
      matchPlayers: {
        orderBy: { match: { createdAt: 'desc' } },
        take: 50,
        include: {
          match: {
            select: {
              category: true,
              createdAt: true,
              startedAt: true,
              endedAt: true
            }
          }
        }
      }
    }
  });

  if (!user) {
    notFound();
  }

  const displayName = user.displayName || user.name || "Joueur";

  // Trouver la meilleure catégorie (plus haut MMR)
  const bestCategory = user.categoryMMRs.length > 0
    ? user.categoryMMRs.reduce((best, curr) => curr.mmr > best.mmr ? curr : best)
    : null;

  // Calculer le temps total joué (en secondes)
  const totalPlayTimeMs = user.matchPlayers.reduce((total, mp) => {
    if (mp.match.startedAt && mp.match.endedAt) {
      return total + (new Date(mp.match.endedAt).getTime() - new Date(mp.match.startedAt).getTime());
    }
    return total;
  }, 0);
  const totalPlayTimeSeconds = Math.floor(totalPlayTimeMs / 1000);

  // Compter les victoires par catégorie (côté serveur, pas limité)
  const winsByCategory = await prisma.matchPlayer.groupBy({
    by: ['matchId'],
    where: {
      userId: id,
      placement: 1
    },
    _count: true
  });

  // Récupérer les catégories des matchs gagnés
  const wonMatchIds = winsByCategory.map(w => w.matchId);
  const wonMatches = await prisma.match.findMany({
    where: { id: { in: wonMatchIds } },
    select: { id: true, category: true }
  });

  // Compteur de victoires par catégorie
  const winsPerCategory: Record<string, number> = {};
  wonMatches.forEach(m => {
    winsPerCategory[m.category] = (winsPerCategory[m.category] || 0) + 1;
  });

  // Préparer les données pour le composant client
  const categoryMMRsData = user.categoryMMRs.map(c => ({
    category: c.category,
    mmr: c.mmr,
    gamesPlayed: c.gamesPlayed,
    currentStreak: c.currentStreak,
    bestStreak: c.bestStreak,
    mmrPeak: c.mmrPeak,
    wins: winsPerCategory[c.category] || 0  // Ajout des wins calculés serveur
  }));

  const matchPlayersData = user.matchPlayers.map(mp => ({
    id: mp.id,
    placement: mp.placement,
    points: mp.points,
    mmrChange: mp.mmrChange,
    mmrAfter: mp.mmrAfter,
    match: {
      category: mp.match.category,
      createdAt: mp.match.createdAt.toISOString()
    }
  }));

  // Données pour le header
  const headerData = {
    displayName,
    image: user.image,
    createdAt: user.createdAt.toISOString(),
    totalPlayTimeSeconds,
    bestCategory: bestCategory ? {
      category: bestCategory.category,
      mmr: bestCategory.mmr,
      currentStreak: bestCategory.currentStreak,
      bestStreak: bestCategory.bestStreak
    } : null
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Profile Header */}
          <ProfileHeader {...headerData} />

          {/* Stats par catégorie avec onglets */}
          <CategoryStats 
            categoryMMRs={categoryMMRsData}
            matchPlayers={matchPlayersData}
          />

        </div>
      </main>
    </div>
  );
}


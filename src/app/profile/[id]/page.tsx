import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { getRankProgress } from "@/lib/mmr";
import { CategoryStats } from "@/components/profile/category-stats";
import { ProfileHeader } from "@/components/profile/profile-header";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;

  // Récupérer l'utilisateur avec ses MMR par catégorie
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      categoryMMRs: true,
      matchPlayers: {
        orderBy: { match: { createdAt: 'desc' } },
        take: 50, // Plus de matchs pour le filtrage par catégorie
        include: {
          match: {
            select: {
              category: true,
              createdAt: true
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
  const mmr = user.mmr || 1000;
  const gamesPlayed = user.gamesPlayed || 0;
  const rankInfo = getRankProgress(mmr);
  const isCalibrating = gamesPlayed < 5;

  // Préparer les données pour le composant client
  const categoryMMRsData = user.categoryMMRs.map(c => ({
    category: c.category,
    mmr: c.mmr,
    gamesPlayed: c.gamesPlayed
  }));

  const matchPlayersData = user.matchPlayers.map(mp => ({
    id: mp.id,
    placement: mp.placement,
    points: mp.points,
    mmrChange: mp.mmrChange,
    match: {
      category: mp.match.category,
      createdAt: mp.match.createdAt.toISOString()
    }
  }));

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Profile Header */}
          <ProfileHeader displayName={displayName} image={user.image} />

          {/* Stats par catégorie avec onglets */}
          <CategoryStats 
            categoryMMRs={categoryMMRsData}
            matchPlayers={matchPlayersData}
            globalMMR={mmr}
            globalGamesPlayed={gamesPlayed}
          />
        </div>
      </main>
    </div>
  );
}


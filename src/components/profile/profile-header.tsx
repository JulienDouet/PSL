"use client";

import { useTranslation } from "@/lib/i18n/context";
import { Card, CardContent } from "@/components/ui/card";

interface ProfileHeaderProps {
  displayName: string;
  image: string | null;
}

export function ProfileHeader({ displayName, image }: ProfileHeaderProps) {
  const { t } = useTranslation();

  return (
    <Card className="bg-card border-border/50 card-glow mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-4xl border-2 border-primary/30 overflow-hidden">
            {image ? (
              <img src={image} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              displayName[0]?.toUpperCase() || "?"
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-1">
              <span className="text-gradient">{displayName}</span>
            </h1>
            <div className="text-muted-foreground">
              {t.profile.player_psl}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { useSession } from "@/lib/auth-client";
import { useTranslation } from "@/lib/i18n/context";

export default function LandingPage() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  
  // Redirection vers dashboard si connecté, sinon login
  const ctaHref = session ? "/dashboard" : "/login";

  const ranksList = [
    { icon: "🟤", nameKey: "bronze" as const, color: "#CD7F32" },
    { icon: "⚪", nameKey: "silver" as const, color: "#C0C0C0" },
    { icon: "🟡", nameKey: "gold" as const, color: "#FFD700" },
    { icon: "🔵", nameKey: "platinum" as const, color: "#00CED1" },
    { icon: "💎", nameKey: "diamond" as const, color: "#B9F2FF" },
    { icon: "👑", nameKey: "master" as const, color: "#9B59B6" },
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm">
            {t.landing.badge}
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="text-gradient">PopSauce</span>
            <br />
            <span className="text-foreground">League</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            {t.landing.subtitle}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={ctaHref}>
              <Button size="lg" className="bg-gradient-psl hover:opacity-90 transition-opacity text-lg px-8 py-6 glow-primary">
                {t.landing.cta_join}
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button size="lg" variant="outline" className="border-primary/50 hover:border-primary hover:bg-primary/10 text-lg px-8 py-6">
                {t.landing.cta_leaderboard}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-card/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t.landing.why_psl.replace('PSL', '')} <span className="text-gradient">PSL</span> ?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-card border-border/50 card-glow hover:border-primary/50 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-xl font-bold mb-2">{t.landing.feature_mmr_title}</h3>
                <p className="text-muted-foreground">
                  {t.landing.feature_mmr_desc}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border/50 card-glow hover:border-primary/50 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-xl font-bold mb-2">{t.landing.feature_stats_title}</h3>
                <p className="text-muted-foreground">
                  {t.landing.feature_stats_desc}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border/50 card-glow hover:border-primary/50 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-4xl mb-4">🏆</div>
                <h3 className="text-xl font-bold mb-2">{t.landing.feature_seasons_title}</h3>
                <p className="text-muted-foreground">
                  {t.landing.feature_seasons_desc}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Ranks Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            {t.landing.ranks_title.split(' ').slice(0, -1).join(' ')} <span className="text-gradient">{t.landing.ranks_title.split(' ').slice(-1)}</span>
          </h2>
          <p className="text-muted-foreground mb-12 max-w-xl mx-auto">
            {t.landing.ranks_subtitle}
          </p>
          
          <div className="flex flex-wrap justify-center gap-6">
            {ranksList.map((rank) => (
              <div
                key={rank.nameKey}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/50 transition-all duration-300"
                style={{ borderColor: `${rank.color}30` }}
              >
                <span className="text-4xl animate-float" style={{ animationDelay: `${Math.random() * 2}s` }}>
                  {rank.icon}
                </span>
                <span className="font-medium" style={{ color: rank.color }}>
                  {t.ranks[rank.nameKey]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary/20 to-accent/20">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            {t.landing.ready_title}
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            {t.landing.ready_subtitle}
          </p>
          <Link href={ctaHref}>
            <Button size="lg" className="bg-gradient-psl hover:opacity-90 transition-opacity text-lg px-10 py-6 glow-primary animate-glow">
              {t.landing.cta_start}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/50">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎮</span>
            <span className="font-bold text-gradient">PSL</span>
            <span className="text-muted-foreground">© 2025</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-muted-foreground text-sm">
            <Link href="/leaderboard" className="hover:text-foreground transition-colors">
              {t.landing.footer_leaderboard}
            </Link>

            <a href="https://github.com/JulienDouet/PSL" className="hover:text-foreground transition-colors">
              GitHub
            </a>
            <span className="hidden sm:inline text-border">|</span>
            <Link href="/legal/mentions" className="hover:text-foreground transition-colors">
              {t.landing.footer_legal}
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
              {t.landing.footer_privacy}
            </Link>
            <Link href="/legal/terms" className="hover:text-foreground transition-colors">
              {t.landing.footer_terms}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}


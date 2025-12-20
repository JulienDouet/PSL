import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm">
            🏆 Premier système de ranked pour Popsauce
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="text-gradient">PopSauce</span>
            <br />
            <span className="text-foreground">League</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Rejoins la compétition, grimpe dans le classement et deviens le meilleur joueur Popsauce français.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="bg-gradient-psl hover:opacity-90 transition-opacity text-lg px-8 py-6 glow-primary">
                🎮 Rejoindre la Ligue
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button size="lg" variant="outline" className="border-primary/50 hover:border-primary hover:bg-primary/10 text-lg px-8 py-6">
                📊 Voir le classement
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-card/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Pourquoi <span className="text-gradient">PSL</span> ?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-card border-border/50 card-glow hover:border-primary/50 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-xl font-bold mb-2">Système MMR</h3>
                <p className="text-muted-foreground">
                  Un système ELO compétitif qui récompense ta performance. Chaque victoire compte !
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border/50 card-glow hover:border-primary/50 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-xl font-bold mb-2">Stats Détaillées</h3>
                <p className="text-muted-foreground">
                  Analyse tes performances, ton historique et tes points forts pour progresser.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border/50 card-glow hover:border-primary/50 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-4xl mb-4">🏆</div>
                <h3 className="text-xl font-bold mb-2">Saisons Mensuelles</h3>
                <p className="text-muted-foreground">
                  Chaque mois, un nouveau départ. Gagne des badges exclusifs et affiche ton rang.
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
            Grimpe dans les <span className="text-gradient">Rangs</span>
          </h2>
          <p className="text-muted-foreground mb-12 max-w-xl mx-auto">
            De Bronze à Grand Maître, prouve ta valeur et atteins le sommet du classement.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { icon: "🥉", name: "Bronze", color: "#CD7F32" },
              { icon: "⚪", name: "Argent", color: "#C0C0C0" },
              { icon: "🥇", name: "Or", color: "#FFD700" },
              { icon: "💎", name: "Platine", color: "#00CED1" },
              { icon: "💠", name: "Diamant", color: "#B9F2FF" },
              { icon: "👑", name: "Maître", color: "#9B59B6" },
              { icon: "🏆", name: "Grand Maître", color: "#E74C3C" },
            ].map((rank) => (
              <div
                key={rank.name}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/50 transition-all duration-300"
                style={{ borderColor: `${rank.color}30` }}
              >
                <span className="text-4xl animate-float" style={{ animationDelay: `${Math.random() * 2}s` }}>
                  {rank.icon}
                </span>
                <span className="font-medium" style={{ color: rank.color }}>
                  {rank.name}
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
            Prêt à jouer ?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Connecte-toi avec Discord ou Twitch et lance ta première recherche de partie.
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-gradient-psl hover:opacity-90 transition-opacity text-lg px-10 py-6 glow-primary animate-glow">
              🎮 Commencer maintenant
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
            <span className="text-muted-foreground">© 2024</span>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <Link href="/leaderboard" className="hover:text-foreground transition-colors">
              Classement
            </Link>
            <a href="https://discord.gg/psl" className="hover:text-foreground transition-colors">
              Discord
            </a>
            <a href="https://github.com/JulienDouet/PSL" className="hover:text-foreground transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

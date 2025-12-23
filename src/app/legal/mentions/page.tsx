"use client";

import Link from "next/link";
import Image from "next/image";

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <Image src="/transparent logo.png" alt="PSL" width={120} height={60} className="object-contain" />
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-4xl font-bold mb-8">
          Mentions <span className="text-gradient">Légales</span>
        </h1>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Éditeur du site</h2>
            <p>
              Le site <strong className="text-foreground">psl-ranked.app</strong> (ci-après &quot;PSL&quot; ou &quot;PopSauce League&quot;) est édité par :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong className="text-foreground">Nom :</strong> Julien D.</li>
              <li><strong className="text-foreground">Email :</strong> psl.ranked.contact@gmail.com</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Directeur de la publication</h2>
            <p>Julien D.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Hébergement</h2>
            <p>Le site est hébergé par :</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong className="text-foreground">Nom :</strong> Railway Corporation</li>
              <li><strong className="text-foreground">Site web :</strong> <a href="https://railway.app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">railway.app</a></li>
              <li><strong className="text-foreground">Adresse :</strong> 548 Market St, San Francisco, CA 94104, USA</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Propriété intellectuelle</h2>
            <p>
              Le contenu du site (textes, graphismes, logos, icônes) est la propriété de l&apos;éditeur, 
              sauf mention contraire. Toute reproduction, distribution ou modification sans autorisation 
              préalable est interdite.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Note :</strong> PSL n&apos;est pas affilié à JKLM.fun ou Popsauce. 
              Ces noms sont des marques de leurs propriétaires respectifs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Contact</h2>
            <p>
              Pour toute question concernant le site, vous pouvez nous contacter par email à{" "}
              <a href="mailto:psl.ranked.contact@gmail.com" className="text-primary hover:underline">
                psl.ranked.contact@gmail.com
              </a>{" "}
              ou via notre{" "}
              <a href="https://discord.gg/JGHRNy6qRn" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                serveur Discord
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50">
          <Link href="/" className="text-primary hover:underline">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

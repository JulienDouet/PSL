"use client";

import Link from "next/link";
import Image from "next/image";

export default function TermsPage() {
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
          Conditions Générales <span className="text-gradient">d&apos;Utilisation</span>
        </h1>

        <p className="text-muted-foreground mb-8">
          Dernière mise à jour : 21 décembre 2025
        </p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Objet</h2>
            <p>
              Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;accès et 
              l&apos;utilisation du site <strong className="text-foreground">psl-ranked.app</strong> 
              {" "}(ci-après &quot;PSL&quot; ou &quot;PopSauce League&quot;), un service de matchmaking ranked 
              pour le jeu Popsauce sur JKLM.fun.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Acceptation des CGU</h2>
            <p>
              En créant un compte et en utilisant PSL, vous acceptez sans réserve les présentes CGU. 
              Si vous n&apos;acceptez pas ces conditions, vous ne devez pas utiliser le service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Inscription et compte</h2>
            <p>Pour utiliser PSL, vous devez :</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Être âgé d&apos;au moins 13 ans</li>
              <li>Posséder un compte Discord ou Twitch valide</li>
              <li>Vérifier votre pseudonyme JKLM avant de participer aux matchs ranked</li>
              <li>Ne posséder qu&apos;un seul compte PSL (multi-compte interdit)</li>
            </ul>
            <p className="mt-3">
              Vous êtes responsable de la confidentialité de votre compte et de toutes les activités 
              effectuées sous celui-ci.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Règles de conduite</h2>
            <p>En utilisant PSL, vous vous engagez à :</p>
            <ul className="list-disc list-inside mt-2 space-y-2">
              <li>
                <strong className="text-foreground">Jouer de manière loyale :</strong> pas de triche, 
                pas d&apos;utilisation de scripts ou d&apos;outils automatisés pour répondre aux questions
              </li>
              <li>
                <strong className="text-foreground">Respecter les autres joueurs :</strong> pas d&apos;insultes, 
                de harcèlement ou de comportement toxique
              </li>
              <li>
                <strong className="text-foreground">Ne pas manipuler le classement :</strong> pas de matchs 
                arrangés, pas de &quot;boosting&quot;, pas d&apos;intentional throwing
              </li>
              <li>
                <strong className="text-foreground">Respecter le matchmaking :</strong> rejoindre les parties 
                dans les temps et jouer jusqu&apos;à la fin du match
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Sanctions</h2>
            <p>
              Le non-respect des règles de conduite peut entraîner des sanctions, notamment :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Avertissement</li>
              <li>Pénalité MMR</li>
              <li>Suspension temporaire</li>
              <li>Bannissement définitif</li>
            </ul>
            <p className="mt-3">
              Les décisions de modération sont prises par l&apos;équipe PSL et peuvent être contestées 
              sur notre{" "}
              <a href="https://discord.gg/JGHRNy6qRn" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                serveur Discord
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Propriété intellectuelle</h2>
            <p>
              Le contenu du site PSL (code, design, textes, logos) est la propriété de l&apos;éditeur. 
              Vous n&apos;acquérez aucun droit de propriété intellectuelle sur le service.
            </p>
            <p className="mt-2">
              PSL n&apos;est pas affilié à JKLM.fun, Popsauce, Discord ou Twitch. Ces noms et marques 
              appartiennent à leurs propriétaires respectifs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitation de responsabilité</h2>
            <p>
              PSL est fourni &quot;tel quel&quot;, sans garantie d&apos;aucune sorte. L&apos;éditeur ne peut être 
              tenu responsable :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Des interruptions temporaires du service</li>
              <li>De la perte de données ou de progression</li>
              <li>Des actions d&apos;autres utilisateurs</li>
              <li>Des problèmes liés à JKLM.fun ou aux plateformes tierces</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Modifications</h2>
            <p>
              L&apos;éditeur se réserve le droit de modifier les présentes CGU à tout moment. 
              Les utilisateurs seront informés des modifications substantielles via Discord 
              ou notification sur le site. La poursuite de l&apos;utilisation du service après 
              modification vaut acceptation des nouvelles CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Résiliation</h2>
            <p>
              Vous pouvez supprimer votre compte à tout moment en contactant l&apos;équipe PSL. 
              L&apos;éditeur peut également suspendre ou supprimer votre compte en cas de violation des CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Droit applicable</h2>
            <p>
              Les présentes CGU sont régies par le droit français. Tout litige relatif à leur 
              interprétation ou leur exécution sera soumis aux tribunaux français compétents.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Contact</h2>
            <p>
              Pour toute question concernant les CGU, contactez-nous sur notre{" "}
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

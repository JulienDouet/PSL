"use client";

import Link from "next/link";
import Image from "next/image";

export default function PrivacyPolicyPage() {
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
          Politique de <span className="text-gradient">Confidentialité</span>
        </h1>

        <p className="text-muted-foreground mb-8">
          Dernière mise à jour : 21 décembre 2025
        </p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données personnelles est Julien Douet, 
              joignable à l&apos;adresse email :{" "}
              <a href="mailto:psl.ranked.contact@gmail.com" className="text-primary hover:underline">
                psl.ranked.contact@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Données collectées</h2>
            <p>Lors de votre inscription via Discord ou Twitch, nous collectons :</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong className="text-foreground">Identifiant unique</strong> Discord ou Twitch</li>
              <li><strong className="text-foreground">Nom d&apos;utilisateur</strong> et pseudonyme</li>
              <li><strong className="text-foreground">Photo de profil</strong> (avatar)</li>
              <li><strong className="text-foreground">Adresse email</strong> associée au compte</li>
            </ul>
            <p className="mt-3">Lors de l&apos;utilisation du service, nous collectons également :</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Statistiques de jeu (MMR, victoires, défaites, score)</li>
              <li>Historique des matchs</li>
              <li>Pseudonyme JKLM vérifié</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Finalité du traitement</h2>
            <p>Vos données sont utilisées pour :</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Créer et gérer votre compte utilisateur</li>
              <li>Vous identifier lors des matchs ranked</li>
              <li>Calculer et afficher votre classement (MMR)</li>
              <li>Afficher votre profil public sur le leaderboard</li>
              <li>Prévenir les multi-comptes et la triche</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Base légale</h2>
            <p>
              Le traitement de vos données est fondé sur votre <strong className="text-foreground">consentement</strong> 
              {" "}donné lors de la connexion via Discord ou Twitch, et sur l&apos;
              <strong className="text-foreground">exécution du contrat</strong> (CGU) qui vous lie à PSL.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Durée de conservation</h2>
            <p>
              Vos données sont conservées tant que votre compte est actif. 
              En cas de suppression de compte, vos données personnelles seront supprimées 
              dans un délai de 30 jours. Les statistiques de match peuvent être conservées 
              de manière anonymisée à des fins statistiques.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Partage des données</h2>
            <p>
              Vos données ne sont pas vendues ni partagées à des tiers commerciaux. 
              Les données suivantes sont visibles publiquement sur le site :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Nom d&apos;utilisateur et avatar</li>
              <li>Rang, MMR et statistiques de jeu</li>
              <li>Pseudonyme JKLM vérifié</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Vos droits (RGPD)</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong className="text-foreground">Droit d&apos;accès :</strong> obtenir une copie de vos données</li>
              <li><strong className="text-foreground">Droit de rectification :</strong> corriger vos informations</li>
              <li><strong className="text-foreground">Droit à l&apos;effacement :</strong> demander la suppression de votre compte</li>
              <li><strong className="text-foreground">Droit à la portabilité :</strong> récupérer vos données dans un format structuré</li>
              <li><strong className="text-foreground">Droit d&apos;opposition :</strong> vous opposer au traitement de vos données</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez-nous à{" "}
              <a href="mailto:psl.ranked.contact@gmail.com" className="text-primary hover:underline">
                psl.ranked.contact@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Cookies</h2>
            <p>
              PSL utilise uniquement des cookies essentiels au fonctionnement du site 
              (session d&apos;authentification). Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Sécurité</h2>
            <p>
              Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données 
              contre tout accès non autorisé, modification, divulgation ou destruction 
              (chiffrement HTTPS, authentification sécurisée via OAuth2).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Contact</h2>
            <p>
              Pour toute question relative à cette politique de confidentialité, contactez-nous à{" "}
              <a href="mailto:psl.ranked.contact@gmail.com" className="text-primary hover:underline">
                psl.ranked.contact@gmail.com
              </a>
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

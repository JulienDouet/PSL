export const fr = {
  common: {
    loading: "Chargement...",
    search: "Rechercher",
    error: "Une erreur est survenue",
    no_results: "Aucun résultat trouvé.",
    back: "Retour",
    save: "Sauvegarder",
    cancel: "Annuler",
    date_format: "dd/MM/yyyy", // Format pour date-fns ou Intl si besoin
  },
  navbar: {
    dashboard: "Tableau de bord",
    leaderboard: "Classement",
    matches: "Matchs", // Ajouté si présent
    play: "Jouer",
    profile: "Profil",
    login: "Connexion",
    logout: "Déconnexion",
    admin: "Admin"
  },
  dashboard: {
    welcome: "Bon retour, {name} !",
    rank: "Rang",
    mmr: "MMR",
    play_card: {
      title: "Recherche de partie",
      subtitle: "{count} joueurs en ligne",
      waiting: "En recherche...",
      join: "Rejoindre la file",
      cancel: "Annuler",
      in_queue: "{count} en recherche"
    },
    discord_card: {
        title: "Rejoins la communauté",
        desc: "Discute avec les autres joueurs, trouve des adversaires et suis les annonces officielles sur notre Discord.",
        button: "Rejoindre le Discord"
    },
    category_mmr: {
        title: "Progression par Catégorie",
        games: "{count} parties",
        unranked: "Non classé"
    }
  },
  leaderboard: {
    title: "Classement",
    subtitle: "Saison Décembre 2025",
    tabs: {
        mmr: "Classement MMR",
        speed: "Records de Vitesse"
    },
    table: {
        rank: "#",
        player: "Joueur",
        mmr: "MMR",
        wl: "V/D",
        winrate: "Winrate"
    },
    speed: {
        title: "Records de Vitesse",
        search_title: "Filtres de recherche",
        search_placeholder_text: "Grandes réponses (ex: a, le...)",
        search_placeholder_generic: "Rechercher une réponse",
        filter_text: "Par Mot",
        filter_length: "Par Taille",
        letters: "lettres",
        table: {
            rank: "#",
            player: "Joueur",
            answer: "Réponse",
            time: "Temps",
            date: "Date"
        },
        no_records: "Aucun record trouvé."
    },
    no_players: "Aucun joueur classé dans cette catégorie. Joue des parties pour apparaître ici !"
  },
  categories: {
    GP_FR: "Grand Public [FR]",
    MS_EN: "Mainstream [EN]",
    ANIME: "Anime",
    FLAGS: "Drapeaux",
    NOFILTER_FR: "Sans Filtre [FR]",
    NOFILTER_EN: "No Filter [EN]",
    MUSIC: "Musique",
    MOVIES: "Films",
    GAMES: "Jeux Vidéo"
  }
}

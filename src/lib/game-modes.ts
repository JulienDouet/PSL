/**
 * Game Modes Configuration for PSL Matchmaking
 */

import type { Category } from '@prisma/client';

export type GameModeKey = 'GP_FR' | 'MS_EN' | 'ANIME' | 'FLAGS' | 'NOFILTER_FR' | 'NOFILTER_EN';

interface TagOp {
  op: 'union' | 'difference' | 'intersection';
  tag: string;
}

export interface GameMode {
  key: GameModeKey;
  category: Category;
  label: string;
  emoji: string;
  rules: {
    dictionaryId: string;
    scoreGoal?: number;
    challengeDuration?: number;
    tagOps?: TagOp[];
  };
}

const FIXED_SCORE_GOAL = 50;

export const GAME_MODES: Record<GameModeKey, GameMode> = {
  GP_FR: {
    key: 'GP_FR',
    category: 'GP_FR',
    label: 'Grand Public [FR]',
    emoji: '🍿',
    rules: { 
      dictionaryId: 'fr', 
      scoreGoal: FIXED_SCORE_GOAL, 
      challengeDuration: 12,
      tagOps: [
        { op: 'union', tag: 'Grand public' },
        { op: 'difference', tag: 'Difficile' }
      ]
    }
  },
  MS_EN: {
    key: 'MS_EN',
    category: 'MS_EN',
    label: 'Mainstream [EN]',
    emoji: '🍿',
    rules: { 
      dictionaryId: 'en', 
      scoreGoal: FIXED_SCORE_GOAL, 
      challengeDuration: 12,
      tagOps: [
        { op: 'union', tag: 'Mainstream' },
        { op: 'difference', tag: 'Hard' }
      ]
    }
  },
  ANIME: {
    key: 'ANIME',
    category: 'ANIME',
    label: 'Anime',
    emoji: '🎌',
    rules: { 
      dictionaryId: 'en', 
      scoreGoal: FIXED_SCORE_GOAL, 
      challengeDuration: 12,
      tagOps: [
        { op: 'intersection', tag: 'Anime & Manga' }
      ]
    }
  },
  FLAGS: {
    key: 'FLAGS',
    category: 'FLAGS',
    label: 'Drapeaux',
    emoji: '🚩',
    rules: { 
      dictionaryId: 'en', 
      scoreGoal: FIXED_SCORE_GOAL, 
      challengeDuration: 12,
      tagOps: [
        { op: 'intersection', tag: 'Flags' }
      ]
    }
  },
  NOFILTER_FR: {
    key: 'NOFILTER_FR',
    category: 'NOFILTER_FR',
    label: 'Sans Filtre [FR]',
    emoji: '🔥',
    rules: { 
      dictionaryId: 'fr', 
      scoreGoal: FIXED_SCORE_GOAL, 
      challengeDuration: 12,
      tagOps: [], // Tableau vide = clear tous les filtres
    }
  },
  NOFILTER_EN: {
    key: 'NOFILTER_EN',
    category: 'NOFILTER_EN',
    label: 'No Filter [EN]',
    emoji: '🔥',
    rules: { 
      dictionaryId: 'en', 
      scoreGoal: FIXED_SCORE_GOAL, 
      challengeDuration: 12,
      tagOps: [], // Tableau vide = clear tous les filtres
    }
  }
};

export const GAME_MODE_LIST = Object.values(GAME_MODES);
export const DEFAULT_MODE: GameModeKey = 'GP_FR';

export function getGameMode(key: GameModeKey): GameMode {
  return GAME_MODES[key] || GAME_MODES.GP_FR;
}


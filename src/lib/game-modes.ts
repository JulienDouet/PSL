/**
 * Game Modes Configuration for PSL Matchmaking
 */

import type { Category } from '@prisma/client';

export type GameModeKey = 'GP_FR' | 'MS_EN' | 'ANIME' | 'FLAGS' | 'NOFILTER_FR' | 'NOFILTER_EN';

export interface GameMode {
  key: GameModeKey;
  category: Category;
  label: string;
  emoji: string;
  rules: {
    dictionaryId: string;
    scoreGoal?: number;
    challengeDuration?: number;
  };
}

export const GAME_MODES: Record<GameModeKey, GameMode> = {
  GP_FR: {
    key: 'GP_FR',
    category: 'GP',
    label: 'GP FR',
    emoji: '🇫🇷',
    rules: { dictionaryId: 'fr', scoreGoal: 150, challengeDuration: 12 }
  },
  MS_EN: {
    key: 'MS_EN',
    category: 'GP',
    label: 'MS EN',
    emoji: '🇬🇧',
    rules: { dictionaryId: 'en', scoreGoal: 150, challengeDuration: 12 }
  },
  ANIME: {
    key: 'ANIME',
    category: 'ANIME',
    label: 'Anime',
    emoji: '🎌',
    rules: { dictionaryId: 'en', scoreGoal: 150, challengeDuration: 12 }
  },
  FLAGS: {
    key: 'FLAGS',
    category: 'FLAGS',
    label: 'Drapeaux',
    emoji: '🚩',
    rules: { dictionaryId: 'en', scoreGoal: 150, challengeDuration: 12 }
  },
  NOFILTER_FR: {
    key: 'NOFILTER_FR',
    category: 'NOFILTER',
    label: 'Sans Filtre FR',
    emoji: '🔥',
    rules: { dictionaryId: 'fr', scoreGoal: 150, challengeDuration: 12 }
  },
  NOFILTER_EN: {
    key: 'NOFILTER_EN',
    category: 'NOFILTER',
    label: 'No Filter EN',
    emoji: '💥',
    rules: { dictionaryId: 'en', scoreGoal: 150, challengeDuration: 12 }
  }
};

export const GAME_MODE_LIST = Object.values(GAME_MODES);
export const DEFAULT_MODE: GameModeKey = 'GP_FR';

export function getGameMode(key: GameModeKey): GameMode {
  return GAME_MODES[key] || GAME_MODES.GP_FR;
}

import { DifficultyMap, DifficultyConfig } from '../engine/types';

/**
 * Difficulty configurations for classic Minesweeper modes
 */
export const DIFFICULTIES: DifficultyMap = {
  easy: {
    rows: 9,
    cols: 9,
    mines: 10
  },
  medium: {
    rows: 16,
    cols: 16,
    mines: 40
  },
  custom: {
    rows: 16,
    cols: 16,
    mines: 99
  }
};

/**
 * Validate a difficulty configuration
 */
export function isValidDifficulty(difficulty: string): boolean {
  return difficulty in DIFFICULTIES;
}

/**
 * Get difficulty config by name
 */
export function getDifficultyConfig(difficulty: string): DifficultyConfig | null {
  return DIFFICULTIES[difficulty] || null;
}

/**
 * Get all difficulty names
 */
export function getAllDifficulties(): string[] {
  return Object.keys(DIFFICULTIES);
}

/**
 * Validate custom difficulty config
 */
export function isValidConfig(config: DifficultyConfig): boolean {
  return (
    config.rows >= 5 &&
    config.rows <= 50 &&
    config.cols >= 5 &&
    config.cols <= 50 &&
    config.mines > 0 &&
    config.mines < config.rows * config.cols
  );
}

import {
  GameSettings,
  HighScore,
  StoredGameState,
  GameState,
} from '../engine/types';

const STORAGE_KEYS = {
  SETTINGS: 'minesweeper_settings',
  HIGH_SCORES: 'minesweeper_high_scores',
  CURRENT_GAME: 'minesweeper_current_game'
};

/**
 * LocalStorage manager for persisting game data client-side
 */
export class LocalStorageManager {
  /**
   * Load game settings, or return defaults if not found
   */
  static loadSettings(): GameSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored) as GameSettings;
        if (parsed.currentDifficulty === 'hard') {
          parsed.currentDifficulty = 'custom';
        }
        if (!parsed.customConfig) {
          parsed.customConfig = LocalStorageManager.getDefaultSettings().customConfig;
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }

    return LocalStorageManager.getDefaultSettings();
  }

  /**
   * Save game settings
   */
  static saveSettings(settings: GameSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  }

  /**
   * Get default settings
   */
  static getDefaultSettings(): GameSettings {
    return {
      currentDifficulty: 'easy',
      soundEnabled: false,
      theme: 'classic',
      customConfig: {
        rows: 30,
        cols: 16,
        mines: 99
      },
      learningModeEnabled: false
    };
  }

  /**
   * Load high scores from storage
   */
  static loadHighScores(): HighScore[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
      if (stored) {
        const scores = JSON.parse(stored) as HighScore[];
        // Sort by time (ascending)
        return scores.sort((a, b) => a.time - b.time);
      }
    } catch (e) {
      console.error('Error loading high scores:', e);
    }
    return [];
  }

  /**
   * Save a high score
   */
  static saveHighScore(score: HighScore): void {
    try {
      const scores = LocalStorageManager.loadHighScores();
      scores.push(score);
      // Keep top 10 per difficulty
      const grouped = new Map<string, HighScore[]>();
      for (const s of scores) {
        if (!grouped.has(s.difficulty)) {
          grouped.set(s.difficulty, []);
        }
        grouped.get(s.difficulty)!.push(s);
      }

      // Keep top 10 for each difficulty and sort
      const result: HighScore[] = [];
      for (const [_, diffScores] of grouped) {
        diffScores.sort((a, b) => a.time - b.time);
        result.push(...diffScores.slice(0, 10));
      }

      localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(result));
    } catch (e) {
      console.error('Error saving high score:', e);
    }
  }

  /**
   * Get high scores for a specific difficulty
   */
  static getHighScoresForDifficulty(difficulty: string): HighScore[] {
    const scores = LocalStorageManager.loadHighScores();
    return scores.filter(s => s.difficulty === difficulty).slice(0, 10);
  }

  /**
   * Save current game state (for resume functionality)
   */
  static saveCurrentGame(state: GameState, difficulty: string): void {
    try {
      const stored: StoredGameState = {
        state,
        difficulty,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.CURRENT_GAME, JSON.stringify(stored));
    } catch (e) {
      console.error('Error saving current game:', e);
    }
  }

  /**
   * Load current game state if available
   */
  static loadCurrentGame(): StoredGameState | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_GAME);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredGameState;
        if (parsed.difficulty === 'hard') {
          parsed.difficulty = 'custom';
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error loading current game:', e);
    }
    return null;
  }

  /**
   * Clear current game
   */
  static clearCurrentGame(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_GAME);
    } catch (e) {
      console.error('Error clearing current game:', e);
    }
  }

  /**
   * Check if storage is available
   */
  static isAvailable(): boolean {
    try {
      const test = '__ls_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }
}

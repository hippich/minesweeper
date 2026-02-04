/**
 * Minesweeper Game - Entry Point
 * Initializes and runs the game
 */

import { GameEngine } from './src/engine/GameEngine';
import { Renderer } from './src/ui/Renderer';
import { Controls } from './src/ui/Controls';
import { StateManager } from './src/state/StateManager';
import { LocalStorageManager } from './src/storage/LocalStorage';
import { getDifficultyConfig } from './src/config/difficulties';

/**
 * Main application class
 */
class MinesweeperApp {
  private gameEngine: GameEngine;
  private renderer: Renderer;
  private controls: Controls;
  private stateManager: StateManager;

  constructor() {
    // Initialize state manager
    this.stateManager = new StateManager();

    // Load settings
    const settings = LocalStorageManager.loadSettings();

    // Get initial difficulty config
    let config = getDifficultyConfig(settings.currentDifficulty);
    if (settings.currentDifficulty === 'custom' && settings.customConfig) {
      config = settings.customConfig;
    }
    if (!config) {
      throw new Error(`Invalid difficulty: ${settings.currentDifficulty}`);
    }

    // Initialize game engine
    this.gameEngine = new GameEngine(config.rows, config.cols, config.mines);

    // Get board container
    const boardContainer = document.getElementById('board-container-inner');
    if (!boardContainer) {
      throw new Error('Board container not found');
    }

    // Initialize renderer
    this.renderer = new Renderer(boardContainer, this.gameEngine);

    // Initialize controls
    this.controls = new Controls(this.gameEngine, this.renderer, this.stateManager);

    // Setup game engine listeners for state management
    this.setupStateManagement();

    // Try to resume saved game
    if (!this.controls.resumeGame()) {
      // Start fresh game
      this.renderer.renderBoard();
    }

    // Display high scores
    this.displayHighScores();
  }

  /**
   * Setup listeners to track game state changes for undo system
   */
  private setupStateManagement(): void {
    // Save state on each cell reveal or flag
    this.gameEngine.on('cell-revealed', () => {
      this.controls.saveState();
      const state = this.gameEngine.getState();
      LocalStorageManager.saveCurrentGame(state, this.controls.getCurrentDifficulty());
    });

    this.gameEngine.on('flag-toggled', () => {
      this.controls.saveState();
      const state = this.gameEngine.getState();
      LocalStorageManager.saveCurrentGame(state, this.controls.getCurrentDifficulty());
    });

    // Save game on game end
    this.gameEngine.on('game-won', (data) => {
      // Save high score if no undo was used
      if (!data.hasUsedUndo) {
        const difficulty = this.controls.getCurrentDifficulty();
        LocalStorageManager.saveHighScore({
          difficulty,
          time: data.time,
          timestamp: Date.now()
        });
        this.displayHighScores();
      }

      // Clear saved game
      LocalStorageManager.clearCurrentGame();
    });

    this.gameEngine.on('game-lost', (): void => {
      // Clear saved game
      LocalStorageManager.clearCurrentGame();
    });

    // Save game state periodically during play
    this.gameEngine.on('timer-update', (data) => {
      if (data.elapsedTime % 10 === 0) {
        // Save every 10 seconds
        const state = this.gameEngine.getState();
        LocalStorageManager.saveCurrentGame(state, this.controls.getCurrentDifficulty());
      }
    });
  }

  /**
   * Display high scores
   */
  private displayHighScores(): void {
    const difficulties = ['easy', 'medium', 'custom'];

    for (const difficulty of difficulties) {
      const scores = LocalStorageManager.getHighScoresForDifficulty(difficulty);
      const scoreList = document.getElementById(`${difficulty}-scores`);

      if (scoreList) {
        scoreList.innerHTML = '';

        if (scores.length === 0) {
          const li = document.createElement('li');
          li.textContent = 'No scores yet';
          scoreList.appendChild(li);
        } else {
          scores.forEach((score) => {
            const li = document.createElement('li');
            li.textContent = `${score.time}s`;
            scoreList.appendChild(li);
          });
        }
      }
    }
  }

  /**
   * Clean up on page unload
   */
  destroy(): void {
    this.gameEngine.destroy();
    this.renderer.destroy();
    this.controls.destroy();
  }
}

/**
 * Initialize app when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Create app instance
    const app = new MinesweeperApp();

    // Store app for debugging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).app = app;

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      app.destroy();
    });

    console.log('Minesweeper game initialized successfully');
  } catch (error) {
    console.error('Failed to initialize game:', error);
    const appDiv = document.getElementById('app');
    if (appDiv) {
      appDiv.innerHTML = `<div style="color: red; padding: 20px;">
        Error initializing game: ${error instanceof Error ? error.message : 'Unknown error'}
      </div>`;
    }
  }
});

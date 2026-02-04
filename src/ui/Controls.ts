import { GameEngine } from '../engine/GameEngine';
import { getDifficultyConfig, getAllDifficulties, isValidConfig } from '../config/difficulties';
import { LocalStorageManager } from '../storage/LocalStorage';
import { StateManager } from '../state/StateManager';
import { Renderer } from './Renderer';
import { DifficultyConfig } from '../engine/types';
import { ProbabilityCalculator } from '../ai/ProbabilityCalculator';
import { MinesweeperBoard } from '../engine/Board';

/**
 * Controls handles UI interactions and control flow
 */
export class Controls {
  private gameEngine: GameEngine;
  private renderer: Renderer;
  private stateManager: StateManager;
  private currentDifficulty: string = 'easy';
  private customConfig: DifficultyConfig;
  private learningModeEnabled: boolean = false;

  constructor(
    gameEngine: GameEngine,
    renderer: Renderer,
    stateManager: StateManager
  ) {
    this.gameEngine = gameEngine;
    this.renderer = renderer;
    this.stateManager = stateManager;

    // Load saved difficulty and learning mode
    const settings = LocalStorageManager.loadSettings();
    this.currentDifficulty = settings.currentDifficulty;
    this.customConfig = settings.customConfig || {
      rows: 30,
      cols: 16,
      mines: 99
    };
    this.learningModeEnabled = settings.learningModeEnabled || false;

    this.setupControls();
    this.setupGameEngineListeners();
  }

  /**
   * Set up all control event listeners
   */
  private setupControls(): void {
    // Difficulty buttons
    const difficulties = getAllDifficulties();
    for (const difficulty of difficulties) {
      const button = document.getElementById(`difficulty-${difficulty}`);
      if (button) {
        button.addEventListener('click', () => this.selectDifficulty(difficulty));
      }
    }

    // Smiley button - restart game
    const smileyButton = document.getElementById('status');
    if (smileyButton) {
      smileyButton.addEventListener('click', () => this.newGame());
    }

    // Undo button (in header)
    const undoButtonHeader = document.getElementById('undo-btn-header');
    if (undoButtonHeader) {
      undoButtonHeader.addEventListener('click', () => this.undo());
    }

    // Restart button (shown on win/loss)
    const restartButton = document.getElementById('restart-btn');
    if (restartButton) {
      restartButton.addEventListener('click', () => this.newGame());
    }

    // Learning mode toggle
    const learningModeToggle = document.getElementById('learning-mode-toggle') as HTMLInputElement | null;
    if (learningModeToggle) {
      learningModeToggle.checked = this.learningModeEnabled;
      learningModeToggle.addEventListener('change', () => {
        this.toggleLearningMode(learningModeToggle.checked);
      });
    }

    // Custom dialog buttons
    const customCancel = document.getElementById('custom-cancel');
    if (customCancel) {
      customCancel.addEventListener('click', () => this.closeCustomDialog());
    }

    const customStart = document.getElementById('custom-start');
    if (customStart) {
      customStart.addEventListener('click', () => this.applyCustomDialog());
    }

    // Highlight current difficulty
    this.updateDifficultyButtons();
    this.updateCustomLabel();
  }

  /**
   * Set up game engine event listeners for learning mode updates
   */
  private setupGameEngineListeners(): void {
    this.gameEngine.on('cell-revealed', () => {
      if (this.learningModeEnabled) {
        this.updateProbabilities();
      }
    });

    this.gameEngine.on('flag-toggled', () => {
      if (this.learningModeEnabled) {
        this.updateProbabilities();
      }
    });

    this.gameEngine.on('new-game', () => {
      if (this.learningModeEnabled) {
        this.updateProbabilities();
      }
    });

    this.gameEngine.on('state-restored', () => {
      if (this.learningModeEnabled) {
        this.updateProbabilities();
      }
    });
  }

  /**
   * Select a difficulty and start new game
   */
  selectDifficulty(difficulty: string): void {
    if (difficulty === 'custom') {
      this.openCustomDialog();
      return;
    }

    this.currentDifficulty = difficulty;

    // Save setting
    const settings = LocalStorageManager.loadSettings();
    settings.currentDifficulty = difficulty;
    LocalStorageManager.saveSettings(settings);

    // Clear history and start new game
    this.stateManager.clear();
    this.newGame();

    // Update button highlights
    this.updateDifficultyButtons();
  }

  /**
   * Update difficulty button styles
   */
  private updateDifficultyButtons(): void {
    const difficulties = getAllDifficulties();
    for (const difficulty of difficulties) {
      const button = document.getElementById(`difficulty-${difficulty}`);
      if (button) {
        if (difficulty === this.currentDifficulty) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      }
    }
  }

  /**
   * Start a new game with current difficulty
   */
  newGame(): void {
    let config = getDifficultyConfig(this.currentDifficulty);
    if (this.currentDifficulty === 'custom') {
      config = this.customConfig;
    }
    if (!config) return;

    // Clear history
    this.stateManager.clear();

    // Clear message
    this.renderer.clearMessage();

    // Start new game
    this.gameEngine.newGame(config.rows, config.cols, config.mines);
    this.renderer.renderBoard();

    // Seed undo history with initial state
    this.stateManager.saveState(this.gameEngine.getState());

    // Update undo button
    this.updateUndoButton();
  }

  /**
   * Undo last move
   */
  undo(): void {
    const previousState = this.stateManager.undo();
    if (!previousState) return;

    // Mark that undo was used
    this.gameEngine.getState().hasUsedUndo = true;

    // Restore state in game engine
    this.gameEngine.restoreState(previousState);
    this.renderer.clearMessage();
    this.renderer.renderBoard();

    // Update undo button
    this.updateUndoButton();
  }

  /**
   * Update undo button availability
   */
  updateUndoButton(): void {
    const undoButtonHeader = document.getElementById('undo-btn-header') as HTMLButtonElement | null;
    const canUndo = this.stateManager.canUndo();
    
    if (undoButtonHeader) {
      undoButtonHeader.disabled = !canUndo;
    }
  }

  /**
   * Save game state (call after each move)
   */
  saveState(): void {
    const state = this.gameEngine.getState();
    this.stateManager.saveState(state);
    this.updateUndoButton();
  }

  /**
   * Get current difficulty
   */
  getCurrentDifficulty(): string {
    return this.currentDifficulty;
  }

  private openCustomDialog(): void {
    const modal = document.getElementById('custom-modal');
    const rowsInput = document.getElementById('custom-rows') as HTMLInputElement | null;
    const colsInput = document.getElementById('custom-cols') as HTMLInputElement | null;
    const minesInput = document.getElementById('custom-mines') as HTMLInputElement | null;
    const error = document.getElementById('custom-error');

    if (!modal || !rowsInput || !colsInput || !minesInput) return;

    rowsInput.value = String(this.customConfig.rows);
    colsInput.value = String(this.customConfig.cols);
    minesInput.value = String(this.customConfig.mines);
    if (error) error.textContent = '';

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  private closeCustomDialog(): void {
    const modal = document.getElementById('custom-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  private applyCustomDialog(): void {
    const rowsInput = document.getElementById('custom-rows') as HTMLInputElement | null;
    const colsInput = document.getElementById('custom-cols') as HTMLInputElement | null;
    const minesInput = document.getElementById('custom-mines') as HTMLInputElement | null;
    const error = document.getElementById('custom-error');

    if (!rowsInput || !colsInput || !minesInput) return;

    const rows = Number(rowsInput.value);
    const cols = Number(colsInput.value);
    const mines = Number(minesInput.value);
    const config = { rows, cols, mines };

    if (!isValidConfig(config)) {
      if (error) {
        if (rows < 5 || rows > 50 || cols < 5 || cols > 50) {
          error.textContent = 'Board size must be 5-50 for both rows and columns.';
        } else if (mines <= 0 || mines >= rows * cols) {
          error.textContent = `Mines must be between 1 and ${rows * cols - 1}.`;
        } else {
          error.textContent = 'Invalid settings. Check sizes and mine count.';
        }
      }
      return;
    }

    this.customConfig = config;
    this.currentDifficulty = 'custom';

    const settings = LocalStorageManager.loadSettings();
    settings.currentDifficulty = 'custom';
    settings.customConfig = config;
    LocalStorageManager.saveSettings(settings);

    this.closeCustomDialog();
    this.newGame();
    this.updateDifficultyButtons();
    this.updateCustomLabel();
  }

  private updateCustomLabel(): void {
    const customButton = document.getElementById('difficulty-custom');
    if (customButton) {
      customButton.textContent = `Custom (${this.customConfig.rows}x${this.customConfig.cols})`;
    }
  }

  /**
   * Resume a saved game if available
   */
  resumeGame(): boolean {
    const saved = LocalStorageManager.loadCurrentGame();
    if (!saved) return false;

    // Check if game is too old (optional - for example, older than 24 hours)
    const age = Date.now() - saved.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (age > maxAge) {
      LocalStorageManager.clearCurrentGame();
      return false;
    }

    // Restore game
    this.currentDifficulty = saved.difficulty;
    if (this.currentDifficulty === 'custom') {
      const settings = LocalStorageManager.loadSettings();
      if (settings.customConfig) {
        this.customConfig = settings.customConfig;
      }
    }
    this.gameEngine.restoreState(saved.state);
    this.renderer.renderBoard();
    this.stateManager.clear();
    this.stateManager.saveState(saved.state);
    this.updateUndoButton();
    this.updateDifficultyButtons();
    this.updateCustomLabel();

    return true;
  }

  /**
   * Toggle learning mode on/off
   */
  private toggleLearningMode(enabled: boolean): void {
    this.learningModeEnabled = enabled;

    // Save setting
    const settings = LocalStorageManager.loadSettings();
    settings.learningModeEnabled = enabled;
    LocalStorageManager.saveSettings(settings);

    // Update renderer state and probabilities
    if (enabled) {
      this.updateProbabilities();
    } else {
      this.renderer.setLearningMode(false);
    }
  }

  /**
   * Calculate and update probability display
   */
  private updateProbabilities(): void {
    if (!this.learningModeEnabled) return;

    const state = this.gameEngine.getState();
    
    // Only show probabilities when game is playing and mines are generated
    if (state.status !== 'playing' || !state.board.minesGenerated) {
      return;
    }

    // Create a MinesweeperBoard instance from state to use with calculator
    const board = new MinesweeperBoard(
      state.board.rows,
      state.board.cols,
      state.board.mines
    );
    
    // Restore board state
    board.getBoard().cells = state.board.cells;
    board.getBoard().minesGenerated = state.board.minesGenerated;

    // Calculate probabilities
    const probabilities = ProbabilityCalculator.calculateProbabilities(
      board,
      state.minesRemaining
    );

    // Update renderer
    this.renderer.setLearningMode(true, probabilities);
  }

  /**
   * Clean up
   */
  destroy(): void {
    // Remove event listeners if needed
  }
}

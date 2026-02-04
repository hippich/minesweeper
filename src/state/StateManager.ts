import { GameState } from '../engine/types';

/**
 * StateManager handles game state snapshots for undo functionality (Memento pattern)
 */
export class StateManager {
  private stateHistory: GameState[] = [];
  private maxHistorySize: number = 100;

  /**
   * Save a game state snapshot
   */
  saveState(state: GameState): void {
    // Deep clone to avoid reference issues
    const snapshot = JSON.parse(JSON.stringify(state));
    this.stateHistory.push(snapshot);

    // Limit history size to prevent excessive memory usage
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  /**
   * Undo to the previous state
   */
  undo(): GameState | null {
    if (this.stateHistory.length < 2) {
      return null; // Need at least one previous state to undo to
    }

    // Remove current state
    this.stateHistory.pop();

    // Return the previous state (after removing current)
    return this.stateHistory[this.stateHistory.length - 1];
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.stateHistory.length >= 2;
  }

  /**
   * Get current state from history
   */
  getCurrentState(): GameState | null {
    if (this.stateHistory.length === 0) {
      return null;
    }
    return this.stateHistory[this.stateHistory.length - 1];
  }

  /**
   * Clear the history
   */
  clear(): void {
    this.stateHistory = [];
  }

  /**
   * Get history size
   */
  getHistorySize(): number {
    return this.stateHistory.length;
  }

  /**
   * Set max history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(1, size);
    while (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }
}

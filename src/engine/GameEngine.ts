import { GameState, GameStatus } from './types';
import { MinesweeperBoard } from './Board';
import { MineGenerator } from './MineGenerator';

/**
 * GameEngine manages the core game logic and state
 */
export class GameEngine {
  private board: MinesweeperBoard;
  private gameState: GameState;
  private timerInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(rows: number, cols: number, mines: number) {
    this.board = new MinesweeperBoard(rows, cols, mines);
    this.gameState = {
      board: this.board.getBoard(),
      status: 'playing',
      elapsedTime: 0,
      minesRemaining: mines,
      cellsRevealed: 0,
      hasUsedUndo: false
    };
  }

  /**
   * Handle left-click on a cell (reveal)
   */
  revealCell(row: number, col: number): boolean {
    if (this.gameState.status !== 'playing') return false;

    const cell = this.board.getCell(row, col);
    if (!cell || cell.isRevealed || cell.isFlagged) return false;

    // Generate mines on first click
    if (!this.board.areMinesGenerated()) {
      MineGenerator.generateMines(this.board, row, col);
      this.startTimer();
    }

    // Reveal the cell
    return this.reveal(row, col);
  }

  /**
   * Internal reveal logic with cascading for empty cells
   */
  private reveal(row: number, col: number, fromCascade: boolean = false): boolean {
    const cell = this.board.getCell(row, col);
    if (!cell || cell.isRevealed || cell.isFlagged) return false;

    cell.isRevealed = true;
    this.gameState.cellsRevealed++;

    this.emit('cell-revealed', { row, col });

    // Hit a mine - game over
    if (cell.isMine) {
      this.endGame('lost');
      this.revealAllMines();
      return false;
    }

    // If empty cell, cascade reveal
    // Only calculate region if not already in a cascade or if we hit a fresh zero
    if (cell.adjacentMines === 0 && !fromCascade) {
      const emptyRegion = MineGenerator.getEmptyRegion(this.board, row, col);
      for (const key of emptyRegion) {
        const [r, c] = key.split(',').map(Number);
        // Don't re-reveal the current cell, but reveal others
        if (r !== row || c !== col) {
           this.reveal(r, c, true);
        }
      }
    }

    // Check win condition
    if (this.checkWin()) {
      this.endGame('won');
    }

    return true;
  }

  /**
   * Handle right-click on a cell (toggle flag)
   */
  toggleFlag(row: number, col: number): boolean {
    if (this.gameState.status !== 'playing') return false;

    const cell = this.board.getCell(row, col);
    if (!cell || cell.isRevealed) return false;

    cell.isFlagged = !cell.isFlagged;
    this.gameState.minesRemaining += cell.isFlagged ? -1 : 1;
    this.emit('flag-toggled', { row, col, isFlagged: cell.isFlagged });

    return true;
  }

  /**
   * Handle chord (middle-click or both buttons)
   * If number of flags matches adjacent mines, reveal all remaining neighbors
   */
  chord(row: number, col: number): boolean {
    if (this.gameState.status !== 'playing') return false;

    const cell = this.board.getCell(row, col);
    if (!cell || !cell.isRevealed || cell.adjacentMines === 0) return false;

    const neighbors = this.board.getNeighbors(row, col);
    const flaggedCount = neighbors.filter(n => n.isFlagged).length;

    if (flaggedCount !== cell.adjacentMines) return false;

    let revealedAny = false;
    for (const neighbor of neighbors) {
      if (!neighbor.isRevealed && !neighbor.isFlagged) {
        if (this.reveal(neighbor.row, neighbor.col, false)) {
          revealedAny = true;
        }
      }
    }

    return revealedAny;
  }

  /**
   * Check if player has won
   */
  private checkWin(): boolean {
    const boardData = this.board.getBoard();
    const totalNonMines = boardData.rows * boardData.cols - boardData.mines;
    return this.gameState.cellsRevealed === totalNonMines;
  }

  /**
   * End the game and stop the timer
   */
  private endGame(status: GameStatus): void {
    this.stopTimer();
    this.emit(`game-${status}`, {
      time: this.gameState.elapsedTime,
      hasUsedUndo: this.gameState.hasUsedUndo
    });
  }

  /**
   * Reveal all mines (when game is lost)
   */
  private revealAllMines(): void {
    const mines = this.board.getMineLocations();
    for (const { row, col } of mines) {
      const cell = this.board.getCell(row, col);
      if (cell && !cell.isRevealed) {
        cell.isRevealed = true;
        this.emit('mine-revealed', { row, col });
      }
    }
  }

  /**
   * Stop the game timer
   */
  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Start the game timer
   */
  private startTimer(): void {
    if (this.timerInterval) return;

    this.timerInterval = setInterval(() => {
      this.gameState.elapsedTime++;
      if (this.gameState.elapsedTime > 9999) {
        this.gameState.elapsedTime = 9999; // Cap at 9999 seconds
        this.stopTimer();
      }
      this.emit('timer-update', { elapsedTime: this.gameState.elapsedTime });
    }, 1000);
  }

  /**
   * New game
   */
  newGame(rows: number, cols: number, mines: number): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.board = new MinesweeperBoard(rows, cols, mines);
    this.gameState = {
      board: this.board.getBoard(),
      status: 'playing',
      elapsedTime: 0,
      minesRemaining: mines,
      cellsRevealed: 0,
      hasUsedUndo: false
    };

    this.emit('new-game', {});
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return {
      ...this.gameState,
      board: this.board.getBoard()
    };
  }

  /**
   * Restore game state (for undo)
   */
  restoreState(state: GameState): void {
    this.gameState = JSON.parse(JSON.stringify(state));
    this.board = new MinesweeperBoard(state.board.rows, state.board.cols, state.board.mines);
    this.board['board'] = JSON.parse(JSON.stringify(state.board));
    this.emit('state-restored', {});
  }

  /**
   * Mark that undo has been used
   */
  markUndoUsed(): void {
    this.gameState.hasUsedUndo = true;
  }

  /**
   * Event emitter system
   */
  on(event: string, listener: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: (data: any) => void): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(listener);
    }
  }

  private emit(event: string, data: any): void {
    if (this.listeners.has(event)) {
      for (const listener of this.listeners.get(event)!) {
        listener(data);
      }
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopTimer();
    this.listeners.clear();
  }
}

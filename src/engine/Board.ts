import { Cell, Board } from './types';

/**
 * Board class manages the Minesweeper grid and cell interactions
 */
export class MinesweeperBoard {
  private board: Board;

  constructor(rows: number, cols: number, mines: number) {
    this.board = {
      rows,
      cols,
      mines,
      cells: [],
      minesGenerated: false
    };
    this.initializeBoard();
  }

  /**
   * Initialize empty board with all cells non-mine and unrevealed
   */
  private initializeBoard(): void {
    this.board.cells = [];
    for (let row = 0; row < this.board.rows; row++) {
      const rowCells: Cell[] = [];
      for (let col = 0; col < this.board.cols; col++) {
        rowCells.push({
          row,
          col,
          isMine: false,
          adjacentMines: 0,
          isRevealed: false,
          isFlagged: false
        });
      }
      this.board.cells.push(rowCells);
    }
  }

  /**
   * Get the current board state
   */
  getBoard(): Board {
    return this.board;
  }

  /**
   * Get a specific cell
   */
  getCell(row: number, col: number): Cell | null {
    if (!this.isValidCell(row, col)) return null;
    return this.board.cells[row][col];
  }

  /**
   * Get all neighbor cells for a given position
   */
  getNeighbors(row: number, col: number): Cell[] {
    const neighbors: Cell[] = [];
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      if (this.isValidCell(newRow, newCol)) {
        neighbors.push(this.board.cells[newRow][newCol]);
      }
    }

    return neighbors;
  }

  /**
   * Count adjacent mines for a cell
   */
  getAdjacentMineCount(row: number, col: number): number {
    const neighbors = this.getNeighbors(row, col);
    return neighbors.filter(cell => cell.isMine).length;
  }

  /**
   * Calculate adjacent mine counts for all cells (call after mine placement)
   */
  calculateAdjacentMines(): void {
    for (let row = 0; row < this.board.rows; row++) {
      for (let col = 0; col < this.board.cols; col++) {
        const cell = this.board.cells[row][col];
        if (!cell.isMine) {
          cell.adjacentMines = this.getAdjacentMineCount(row, col);
        }
      }
    }
  }

  /**
   * Place a mine at the given cell
   */
  setMine(row: number, col: number): boolean {
    if (!this.isValidCell(row, col)) return false;
    this.board.cells[row][col].isMine = true;
    return true;
  }

  /**
   * Check if a cell is in valid bounds
   */
  isValidCell(row: number, col: number): boolean {
    return row >= 0 && row < this.board.rows && col >= 0 && col < this.board.cols;
  }

  /**
   * Get the list of forbidden cells (safe area around first click)
   */
  getForbiddenCells(row: number, col: number): Set<string> {
    const forbidden = new Set<string>();
    const cell = this.getCell(row, col);
    if (cell) {
      forbidden.add(this.cellKey(row, col));
      this.getNeighbors(row, col).forEach(neighbor => {
        forbidden.add(this.cellKey(neighbor.row, neighbor.col));
      });
    }
    return forbidden;
  }

  /**
   * Create a string key for a cell (for Sets/Maps)
   */
  cellKey(row: number, col: number): string {
    return `${row},${col}`;
  }

  /**
   * Deep clone the board state for undo functionality
   */
  clone(): MinesweeperBoard {
    const cloned = new MinesweeperBoard(this.board.rows, this.board.cols, this.board.mines);
    cloned.board = JSON.parse(JSON.stringify(this.board));
    return cloned;
  }

  /**
   * Mark mines generated flag
   */
  setMinesGenerated(generated: boolean): void {
    this.board.minesGenerated = generated;
  }

  /**
   * Check if mines have been generated
   */
  areMinesGenerated(): boolean {
    return this.board.minesGenerated;
  }

  /**
   * Get all mine locations
   */
  getMineLocations(): Array<{ row: number; col: number }> {
    const mines: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < this.board.rows; row++) {
      for (let col = 0; col < this.board.cols; col++) {
        if (this.board.cells[row][col].isMine) {
          mines.push({ row, col });
        }
      }
    }
    return mines;
  }

  /**
   * Get unrevealed cell count
   */
  getUnrevealedCount(): number {
    let count = 0;
    for (let row = 0; row < this.board.rows; row++) {
      for (let col = 0; col < this.board.cols; col++) {
        if (!this.board.cells[row][col].isRevealed) {
          count++;
        }
      }
    }
    return count;
  }
}

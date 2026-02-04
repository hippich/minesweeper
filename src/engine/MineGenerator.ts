import { MinesweeperBoard } from './Board';

/**
 * MineGenerator handles mine placement after first click to ensure safe start
 */
export class MineGenerator {
  /**
   * Generate mines on the board, avoiding the clicked cell and its neighbors
   */
  static generateMines(
    board: MinesweeperBoard,
    firstClickRow: number,
    firstClickCol: number
  ): void {
    // Get cells that cannot have mines (first click + neighbors)
    const forbiddenCells = board.getForbiddenCells(firstClickRow, firstClickCol);

    // Get all available cells for mine placement
    const availableCells: Array<{ row: number; col: number }> = [];
    const boardData = board.getBoard();

    for (let row = 0; row < boardData.rows; row++) {
      for (let col = 0; col < boardData.cols; col++) {
        const key = board.cellKey(row, col);
        if (!forbiddenCells.has(key)) {
          availableCells.push({ row, col });
        }
      }
    }

    // Fisher-Yates shuffle to get random cells
    const shuffled = this.shuffleArray(availableCells);

    // Place mines
    for (let i = 0; i < boardData.mines && i < shuffled.length; i++) {
      const { row, col } = shuffled[i];
      board.setMine(row, col);
    }

    // Calculate adjacent mine counts
    board.calculateAdjacentMines();
    board.setMinesGenerated(true);
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get the safe area that should be revealed on first click (empty region flood fill)
   * Returns all cells that should be auto-revealed when clicking an empty cell
   */
  static getEmptyRegion(
    board: MinesweeperBoard,
    startRow: number,
    startCol: number
  ): Set<string> {
    const cell = board.getCell(startRow, startCol);

    // Only flood fill from empty cells (adjacentMines = 0)
    if (!cell || cell.isMine || cell.adjacentMines > 0) {
      return new Set<string>([board.cellKey(startRow, startCol)]);
    }

    const region = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [
      { row: startRow, col: startCol }
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { row, col } = queue.shift()!;
      const key = board.cellKey(row, col);

      if (visited.has(key)) continue;
      visited.add(key);

      const currentCell = board.getCell(row, col);
      if (!currentCell || currentCell.isMine) continue;

      region.add(key);

      // If this cell is empty (no adjacent mines), check neighbors
      if (currentCell.adjacentMines === 0) {
        const neighbors = board.getNeighbors(row, col);
        for (const neighbor of neighbors) {
          const neighborKey = board.cellKey(neighbor.row, neighbor.col);
          if (!visited.has(neighborKey)) {
            queue.push({ row: neighbor.row, col: neighbor.col });
          }
        }
      }
    }

    return region;
  }
}

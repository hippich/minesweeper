import { ProbabilityMap } from '../engine/types';
import { MinesweeperBoard } from '../engine/Board';

/**
 * ProbabilityCalculator for learning mode
 * Calculates the probability of each unrevealed cell containing a mine
 * using constraint-based analysis
 */
export class ProbabilityCalculator {
  /**
   * Calculate mine probabilities for all unrevealed cells
   * Uses constraint satisfaction to identify definite mines/safes
   * and estimate probabilities for uncertain cells
   * 
   * @param board The game board
   * @param minesRemaining Number of unflagged mines remaining
   * @returns Map of cell keys to probabilities (0-1)
   */
  static calculateProbabilities(
    board: MinesweeperBoard,
    minesRemaining: number
  ): ProbabilityMap {
    const boardData = board.getBoard();
    const result: ProbabilityMap = {};

    const unrevealedCells = new Set<string>();
    const constraints: Array<{ cells: string[]; mines: number }> = [];
    const knownSafe = new Set<string>();
    const knownMines = new Set<string>();

    // Build constraints from revealed number cells
    for (let row = 0; row < boardData.rows; row++) {
      for (let col = 0; col < boardData.cols; col++) {
        const cell = board.getCell(row, col);
        if (!cell) continue;

        if (!cell.isRevealed && !cell.isFlagged) {
          unrevealedCells.add(board.cellKey(row, col));
        }

        if (cell.isRevealed && cell.adjacentMines > 0) {
          const neighbors = board.getNeighbors(row, col);
          const unknown = neighbors.filter(n => !n.isRevealed && !n.isFlagged);
          const flagged = neighbors.filter(n => n.isFlagged);
          const remainingMines = cell.adjacentMines - flagged.length;

          if (unknown.length > 0 && remainingMines >= 0) {
            constraints.push({
              cells: unknown.map(n => board.cellKey(n.row, n.col)),
              mines: remainingMines
            });
          }
        }
      }
    }

    // Iterative constraint propagation
    let changed = true;
    while (changed) {
      changed = false;
      for (const constraint of constraints) {
        let minesLeft = constraint.mines;
        const remainingCells: string[] = [];

        for (const key of constraint.cells) {
          if (knownSafe.has(key)) {
            continue;
          }
          if (knownMines.has(key)) {
            minesLeft -= 1;
            continue;
          }
          remainingCells.push(key);
        }

        minesLeft = Math.max(0, minesLeft);
        constraint.cells = remainingCells;
        constraint.mines = minesLeft;

        if (remainingCells.length === 0) {
          continue;
        }

        if (minesLeft === 0) {
          for (const key of remainingCells) {
            if (!knownSafe.has(key)) {
              knownSafe.add(key);
              changed = true;
            }
          }
        } else if (minesLeft === remainingCells.length) {
          for (const key of remainingCells) {
            if (!knownMines.has(key)) {
              knownMines.add(key);
              changed = true;
            }
          }
        }
      }
    }

    // Record definitive results
    for (const key of knownSafe) {
      result[key] = 0;
    }
    for (const key of knownMines) {
      result[key] = 1.0;
    }

    // Estimate probabilities for frontier cells using constraint averages
    const frontierCells = new Set<string>();
    const probSum: Record<string, number> = {};
    const probCount: Record<string, number> = {};

    for (const constraint of constraints) {
      if (constraint.cells.length === 0) continue;
      const localProb = constraint.mines / constraint.cells.length;
      for (const key of constraint.cells) {
        if (knownSafe.has(key) || knownMines.has(key)) {
          continue;
        }
        frontierCells.add(key);
        probSum[key] = (probSum[key] || 0) + localProb;
        probCount[key] = (probCount[key] || 0) + 1;
      }
    }

    for (const key of frontierCells) {
      if (result[key] === undefined) {
        const average = probCount[key] > 0 ? probSum[key] / probCount[key] : 0;
        result[key] = Math.max(0, Math.min(1, average));
      }
    }

    const minesLeftTotal = Math.max(0, minesRemaining - knownMines.size);
    let expectedFrontierMines = 0;
    for (const key of frontierCells) {
      expectedFrontierMines += result[key] || 0;
    }

    const nonFrontierCells: string[] = [];
    unrevealedCells.forEach(key => {
      if (!frontierCells.has(key) && result[key] === undefined) {
        nonFrontierCells.push(key);
      }
    });

    if (nonFrontierCells.length > 0) {
      const nonFrontierMines = Math.max(0, minesLeftTotal - expectedFrontierMines);
      const nonFrontierProb = nonFrontierMines / nonFrontierCells.length;
      for (const key of nonFrontierCells) {
        result[key] = Math.max(0, Math.min(1, nonFrontierProb));
      }
    }

    // Fill any remaining cells with base probability
    const baseProbability = unrevealedCells.size > 0
      ? minesLeftTotal / unrevealedCells.size
      : 0;

    unrevealedCells.forEach(key => {
      if (result[key] === undefined) {
        result[key] = Math.max(0, Math.min(1, baseProbability));
      }
    });

    return result;
  }

  /**
   * Get cells that can be definitively identified as safe or mines
   */
  static getDefinitiveCells(
    board: MinesweeperBoard,
    minesRemaining: number
  ): {
    safe: Array<{ row: number; col: number }>;
    mines: Array<{ row: number; col: number }>;
  } {
    const probabilities = this.calculateProbabilities(board, minesRemaining);
    const safe: Array<{ row: number; col: number }> = [];
    const mines: Array<{ row: number; col: number }> = [];

    for (const [key, prob] of Object.entries(probabilities)) {
      const [row, col] = key.split(',').map(Number);
      if (prob === 0) {
        safe.push({ row, col });
      } else if (prob === 1.0) {
        mines.push({ row, col });
      }
    }

    return { safe, mines };
  }
}

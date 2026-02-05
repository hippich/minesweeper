import { describe, it, expect } from 'vitest';
import { ProbabilityCalculator } from '../ProbabilityCalculator';
import { MinesweeperBoard } from '../../engine/Board';

const setRevealed = (
  board: MinesweeperBoard,
  row: number,
  col: number,
  adjacentMines: number
): void => {
  const cell = board.getCell(row, col);
  if (!cell) return;
  cell.isRevealed = true;
  cell.isFlagged = false;
  cell.adjacentMines = adjacentMines;
};

const revealAllAsZero = (
  board: MinesweeperBoard,
  skipKeys: Set<string>
): void => {
  const { rows, cols } = board.getBoard();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = board.cellKey(row, col);
      if (skipKeys.has(key)) continue;
      setRevealed(board, row, col, 0);
    }
  }
};

describe('ProbabilityCalculator', () => {
  it('marks all remaining neighbors as mines when count equals remaining cells', () => {
    const board = new MinesweeperBoard(2, 2, 0);

    setRevealed(board, 0, 0, 2);
    setRevealed(board, 0, 1, 0);

    const probabilities = ProbabilityCalculator.calculateProbabilities(board, 2);

    expect(probabilities[board.cellKey(1, 0)]).toBe(1);
    expect(probabilities[board.cellKey(1, 1)]).toBe(1);
  });

  it('derives subset constraints to resolve safe and 50/50 cells', () => {
    const board = new MinesweeperBoard(3, 2, 0);

    setRevealed(board, 0, 0, 1);
    setRevealed(board, 0, 1, 0);
    setRevealed(board, 2, 0, 1);

    const probabilities = ProbabilityCalculator.calculateProbabilities(board, 1);

    const a = board.cellKey(1, 0);
    const b = board.cellKey(1, 1);
    const c = board.cellKey(2, 1);

    expect(probabilities[c]).toBe(0);
    expect(probabilities[a]).toBeCloseTo(0.5, 5);
    expect(probabilities[b]).toBeCloseTo(0.5, 5);
  });

  it('stabilizes the bottom-left mine and far-right safe case', () => {
    const board = new MinesweeperBoard(4, 4, 0);

    const a = board.cellKey(3, 0);
    const b = board.cellKey(1, 2);
    const c = board.cellKey(1, 3);
    const d = board.cellKey(2, 3);

    const skipKeys = new Set([a, b, c, d, board.cellKey(2, 0), board.cellKey(0, 2), board.cellKey(2, 2)]);
    revealAllAsZero(board, skipKeys);

    // A is forced mine (only unknown neighbor of 2,0)
    setRevealed(board, 2, 0, 1);
    // B + C = 1
    setRevealed(board, 0, 2, 1);
    // B + C + D = 1
    setRevealed(board, 2, 2, 1);

    const probabilities = ProbabilityCalculator.calculateProbabilities(board, 2);

    expect(probabilities[a]).toBe(1);
    expect(probabilities[d]).toBe(0);
  });

  it('keeps the 100/50/50/0 bottom row case stable', () => {
    const board = new MinesweeperBoard(5, 5, 0);

    const a = board.cellKey(4, 0);
    const b = board.cellKey(2, 2);
    const c = board.cellKey(2, 3);
    const d = board.cellKey(2, 4);

    const skipKeys = new Set([a, b, c, d, board.cellKey(3, 0), board.cellKey(1, 2), board.cellKey(1, 3)]);
    revealAllAsZero(board, skipKeys);

    // A is forced mine
    setRevealed(board, 3, 0, 1);
    // B + C = 1
    setRevealed(board, 1, 2, 1);
    // B + C + D = 1
    setRevealed(board, 1, 3, 1);

    const probabilities = ProbabilityCalculator.calculateProbabilities(board, 2);

    expect(probabilities[a]).toBe(1);
    expect(probabilities[b]).toBeCloseTo(0.5, 5);
    expect(probabilities[c]).toBeCloseTo(0.5, 5);
    expect(probabilities[d]).toBe(0);
  });
});

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

    // Iterative constraint propagation with subset analysis
    let changed = true;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops
    
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      
      // First, update all constraints based on known information
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

        // Basic deductions
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

      // Subset analysis: compare pairs of constraints and add derived constraints
      const derivedConstraints: Array<{ cells: string[]; mines: number }> = [];
      
      // Limit constraint comparisons to prevent combinatorial explosion
      const maxConstraintsToCompare = Math.min(constraints.length, 50);
      
      for (let i = 0; i < maxConstraintsToCompare; i++) {
        const c1 = constraints[i];
        if (c1.cells.length === 0) continue;

        for (let j = 0; j < constraints.length; j++) {
          if (i === j) continue;
          const c2 = constraints[j];
          if (c2.cells.length === 0) continue;

          // Check if c1 is a subset of c2
          const c1Set = new Set(c1.cells);
          const c2Set = new Set(c2.cells);
          const c1IsSubsetOfC2 = c1.cells.every(cell => c2Set.has(cell));

          if (c1IsSubsetOfC2 && c1.cells.length < c2.cells.length) {
            // c1 ⊆ c2, so we can derive: c2 - c1
            const difference = c2.cells.filter(cell => !c1Set.has(cell));
            const diffMines = c2.mines - c1.mines;

            if (difference.length > 0 && diffMines >= 0) {
              // Immediate deductions
              if (diffMines === 0) {
                // All cells in difference are safe
                for (const key of difference) {
                  if (!knownSafe.has(key) && !knownMines.has(key)) {
                    knownSafe.add(key);
                    changed = true;
                  }
                }
              } else if (diffMines === difference.length) {
                // All cells in difference are mines
                for (const key of difference) {
                  if (!knownMines.has(key) && !knownSafe.has(key)) {
                    knownMines.add(key);
                    changed = true;
                  }
                }
              } else {
                // Add derived constraint for uncertain cases
                const derivedExists = derivedConstraints.some(dc => {
                  if (dc.cells.length !== difference.length || dc.mines !== diffMines) {
                    return false;
                  }
                  return dc.cells.every(c => difference.includes(c));
                });
                
                if (!derivedExists) {
                  derivedConstraints.push({ cells: difference, mines: diffMines });
                }
              }
            }
          }
        }
      }
      
      // Add derived constraints to main constraint list
      if (derivedConstraints.length > 0) {
        constraints.push(...derivedConstraints);
        changed = true;
      }
    }

    // Record definitive results
    for (const key of knownSafe) {
      result[key] = 0;
    }
    for (const key of knownMines) {
      result[key] = 1.0;
    }

    // Get active constraints (those with unknown cells)
    const activeConstraints = constraints.filter(c => c.cells.length > 0);
    
    // Collect frontier cells (cells in at least one constraint)
    const frontierCells = new Set<string>();
    for (const constraint of activeConstraints) {
      for (const key of constraint.cells) {
        if (!knownSafe.has(key) && !knownMines.has(key)) {
          frontierCells.add(key);
        }
      }
    }

    // Partition constraints into independent groups
    const constraintGroups = this.partitionConstraints(activeConstraints);

    // Solve each group independently
    for (const group of constraintGroups) {
      const groupCells = new Set<string>();
      for (const constraint of group) {
        for (const cell of constraint.cells) {
          groupCells.add(cell);
        }
      }

      const cellArray = Array.from(groupCells);
      
      // Use CSP solver for groups up to 20 cells (to keep it fast)
      if (cellArray.length > 0 && cellArray.length <= 20) {
        const solutions = this.solveConstraints(cellArray, group);
        
        if (solutions.length > 0) {
          // Count how many solutions have each cell as a mine
          const mineCounts: Record<string, number> = {};
          for (const key of cellArray) {
            mineCounts[key] = 0;
          }

          for (const solution of solutions) {
            for (const key of solution) {
              mineCounts[key]++;
            }
          }

          // Calculate probabilities
          for (const key of cellArray) {
            result[key] = mineCounts[key] / solutions.length;
          }
        } else {
          // Fallback to constraint averaging if no solutions found
          for (const key of cellArray) {
            result[key] = 0.5;
          }
        }
      } else if (cellArray.length > 20) {
        // Too many cells in this group, use averaging fallback
        const probSum: Record<string, number> = {};
        const probCount: Record<string, number> = {};

        for (const constraint of group) {
          const localProb = constraint.mines / constraint.cells.length;
          for (const key of constraint.cells) {
            probSum[key] = (probSum[key] || 0) + localProb;
            probCount[key] = (probCount[key] || 0) + 1;
          }
        }

        for (const key of cellArray) {
          if (result[key] === undefined) {
            const average = probCount[key] > 0 ? probSum[key] / probCount[key] : 0.5;
            result[key] = Math.max(0, Math.min(1, average));
          }
        }
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
   * Partition constraints into independent groups using union-find
   * Constraints that share cells are in the same group
   */
  private static partitionConstraints(
    constraints: Array<{ cells: string[]; mines: number }>
  ): Array<Array<{ cells: string[]; mines: number }>> {
    if (constraints.length === 0) return [];
    
    // Build cell to constraint mapping
    const cellToConstraints = new Map<string, number[]>();
    constraints.forEach((constraint, idx) => {
      for (const cell of constraint.cells) {
        if (!cellToConstraints.has(cell)) {
          cellToConstraints.set(cell, []);
        }
        cellToConstraints.get(cell)!.push(idx);
      }
    });

    // Union-find to group constraints
    const parent = new Array(constraints.length).fill(0).map((_, i) => i);
    
    const find = (x: number): number => {
      if (parent[x] !== x) {
        parent[x] = find(parent[x]);
      }
      return parent[x];
    };
    
    const union = (x: number, y: number): void => {
      const px = find(x);
      const py = find(y);
      if (px !== py) {
        parent[px] = py;
      }
    };

    // Union constraints that share cells
    for (const constraintIndices of cellToConstraints.values()) {
      for (let i = 1; i < constraintIndices.length; i++) {
        union(constraintIndices[0], constraintIndices[i]);
      }
    }

    // Group constraints by root
    const groups = new Map<number, Array<{ cells: string[]; mines: number }>>();
    constraints.forEach((constraint, idx) => {
      const root = find(idx);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(constraint);
    });

    return Array.from(groups.values());
  }

  /**
   * Solve constraints by enumerating all valid solutions
   * Returns array of solutions, where each solution is a set of cell keys that are mines
   */
  private static solveConstraints(
    cells: string[],
    constraints: Array<{ cells: string[]; mines: number }>
  ): string[][] {
    const solutions: string[][] = [];
    const n = cells.length;
    
    // Enumerate all possible subsets (2^n combinations)
    const maxCombinations = Math.pow(2, n);
    
    // Optimization: limit search if too many combinations
    if (maxCombinations > 1048576) { // 2^20
      return [];
    }

    const maxSolutions = 10000; // Stop after finding enough solutions

    for (let mask = 0; mask < maxCombinations; mask++) {
      // Early exit if we have enough solutions
      if (solutions.length >= maxSolutions) {
        break;
      }
      
      const mines: string[] = [];
      
      // Build assignment from bitmask
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          mines.push(cells[i]);
        }
      }

      // Check if this assignment satisfies all constraints
      const mineSet = new Set(mines);
      let valid = true;

      for (const constraint of constraints) {
        const mineCount = constraint.cells.filter(c => mineSet.has(c)).length;
        if (mineCount !== constraint.mines) {
          valid = false;
          break;
        }
      }

      if (valid) {
        solutions.push(mines);
      }
    }

    return solutions;
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

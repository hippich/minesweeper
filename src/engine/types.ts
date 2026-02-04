/**
 * Core types and interfaces for the Minesweeper game engine
 */

export interface Cell {
  row: number;
  col: number;
  isMine: boolean;
  adjacentMines: number;
  isRevealed: boolean;
  isFlagged: boolean;
}

export interface Board {
  rows: number;
  cols: number;
  mines: number;
  cells: Cell[][];
  minesGenerated: boolean;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  board: Board;
  status: GameStatus;
  elapsedTime: number;
  minesRemaining: number;
  cellsRevealed: number;
  hasUsedUndo: boolean;
}

export interface DifficultyConfig {
  rows: number;
  cols: number;
  mines: number;
}

export interface DifficultyMap {
  [key: string]: DifficultyConfig;
}

export interface GameSettings {
  currentDifficulty: string;
  soundEnabled: boolean;
  theme: 'classic' | 'dark';
  customConfig?: DifficultyConfig;
  learningModeEnabled: boolean;
}

export interface HighScore {
  difficulty: string;
  time: number;
  timestamp: number;
}

export interface StoredGameState {
  state: GameState;
  difficulty: string;
  timestamp: number;
}

export interface ProbabilityMap {
  [key: string]: number; // cellKey -> probability between 0 and 1
}

export type CellClickType = 'left' | 'right' | 'chord';

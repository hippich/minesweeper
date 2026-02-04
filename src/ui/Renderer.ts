import { GameState, Cell, ProbabilityMap } from '../engine/types';
import { GameEngine } from '../engine/GameEngine';

/**
 * Renderer handles all DOM manipulation and visual updates
 */
export class Renderer {
  private container: HTMLElement;
  private gameEngine: GameEngine;
  private boardElement: HTMLElement | null = null;
  private timerElement: HTMLElement | null = null;
  private counterElement: HTMLElement | null = null;
  private statusElement: HTMLElement | null = null;
  private messageElement: HTMLElement | null = null;
  private messageAlertElement: HTMLElement | null = null;
  private probabilities: ProbabilityMap = {};
  private learningModeEnabled: boolean = false;

  private cellMap: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement, gameEngine: GameEngine) {
    this.container = container;
    this.gameEngine = gameEngine;
    this.cacheElements();
    this.setupEventListeners();
  }

  private cacheElements(): void {
      this.timerElement = document.getElementById('timer');
      this.counterElement = document.getElementById('counter');
      this.statusElement = document.getElementById('status');
      this.messageElement = document.getElementById('message');
      this.messageAlertElement = document.getElementById('message-alert');
  }

  /**
   * Set up game engine event listeners
   */
  private setupEventListeners(): void {
    this.gameEngine.on('cell-revealed', (data) => this.updateCell(data.row, data.col));
    this.gameEngine.on('flag-toggled', (data) => this.updateCell(data.row, data.col));
    this.gameEngine.on('timer-update', (data) => this.updateTimer(data.elapsedTime));
    this.gameEngine.on('mine-revealed', (data) => this.updateCell(data.row, data.col));
    this.gameEngine.on('game-won', (data) => this.onGameWon(data));
    this.gameEngine.on('game-lost', () => this.onGameLost());
    this.gameEngine.on('new-game', () => this.renderBoard());
    this.gameEngine.on('state-restored', () => this.renderBoard());
  }

  /**
   * Initial board render
   */
  renderBoard(): void {
    const state = this.gameEngine.getState();

    if (!state.board.minesGenerated) {
      this.probabilities = {};
    }

    if (!this.boardElement) {
      this.boardElement = document.createElement('div');
      this.boardElement.id = 'game-board';
      this.boardElement.className = 'board';
      this.container.appendChild(this.boardElement);
      this.setupBoardInteractions();
    }

    this.boardElement.innerHTML = '';
    this.boardElement.style.gridTemplateColumns = `repeat(${state.board.cols}, 1fr)`;
    this.cellMap.clear();

    const fragment = document.createDocumentFragment();
    for (let row = 0; row < state.board.rows; row++) {
      for (let col = 0; col < state.board.cols; col++) {
        const cell = state.board.cells[row][col];
        const cellElement = this.createCellElement(cell, row, col);
        this.cellMap.set(`${row},${col}`, cellElement);
        fragment.appendChild(cellElement);
      }
    }
    this.boardElement.appendChild(fragment);

    this.updateInfo(state);
  }

  /**
   * Setup centralized event listeners for the board (Event Delegation)
   */
  private setupBoardInteractions(): void {
    if (!this.boardElement) return;

    const getCellTarget = (e: Event): HTMLElement | null => {
      const target = e.target as HTMLElement;
      return target.closest('.cell');
    };

    const getCellCoords = (cell: HTMLElement): { row: number, col: number } | null => {
        const row = parseInt(cell.dataset.row || '-1');
        const col = parseInt(cell.dataset.col || '-1');
        return (row >= 0 && col >= 0) ? { row, col } : null;
    };

    // State for touch handling
    let lastTapTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;
    let touchHandled = false;
    let isTouchActive = false;
    let longPressTimer: number | null = null;
    let actionPerformed = false;
    let activeTouchCell: HTMLElement | null = null;

    const LONG_PRESS_DURATION = 400;
    const DOUBLE_TAP_WINDOW = 300;
    const MOVE_THRESHOLD = 15;

    // Mouse interactions
    this.boardElement.addEventListener('mousedown', (e) => {
        const cell = getCellTarget(e);
        if (!cell) return;
        
        if (this.gameEngine.getState().status === 'playing') {
            const statusElement = document.getElementById('status');
            if (statusElement) statusElement.textContent = '😮';
        }
    });

    this.boardElement.addEventListener('mouseup', () => {
         const statusElement = document.getElementById('status');
         if (statusElement) {
             const state = this.gameEngine.getState();
             statusElement.textContent = 
                state.status === 'won' ? '😎' : 
                state.status === 'lost' ? '😵' : '😊';
         }
    });
    
    this.boardElement.addEventListener('mouseleave', () => {
         const statusElement = document.getElementById('status');
         if (statusElement) {
             const state = this.gameEngine.getState();
             statusElement.textContent = 
                state.status === 'won' ? '😎' : 
                state.status === 'lost' ? '😵' : '😊';
         }
    });

    this.boardElement.addEventListener('click', (e) => {
        if (touchHandled) {
            e.preventDefault();
            e.stopPropagation();
            touchHandled = false;
            return;
        }

        const cell = getCellTarget(e);
        if (!cell) return;
        const coords = getCellCoords(cell);
        
        if (coords && this.gameEngine.getState().status === 'playing') {
            this.gameEngine.revealCell(coords.row, coords.col);
        }
    });

    this.boardElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (touchHandled || isTouchActive) return;

        const cell = getCellTarget(e);
        if (!cell) return;
        const coords = getCellCoords(cell);
        
        if (coords && this.gameEngine.getState().status === 'playing') {
            this.gameEngine.toggleFlag(coords.row, coords.col);
        }
    });

    this.boardElement.addEventListener('dblclick', (e) => {
        e.preventDefault();
        const cell = getCellTarget(e);
        if (!cell) return;
        const coords = getCellCoords(cell);
        
        if (coords && this.gameEngine.getState().status === 'playing') {
            this.gameEngine.chord(coords.row, coords.col);
        }
    });

    // Touch interactions
    this.boardElement.addEventListener('touchstart', (e) => {
        const cell = getCellTarget(e);
        if (!cell || this.gameEngine.getState().status !== 'playing') return;

        isTouchActive = true;
        activeTouchCell = cell;
        touchMoved = false;
        actionPerformed = false;
        touchStartX = e.touches[0]?.clientX ?? 0;
        touchStartY = e.touches[0]?.clientY ?? 0;

        cell.style.opacity = '0.7';
        cell.style.transform = 'scale(0.95)';

        if (longPressTimer !== null) {
            window.clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        longPressTimer = window.setTimeout(() => {
            if (!touchMoved && !actionPerformed && activeTouchCell === cell) {
                actionPerformed = true;
                longPressTimer = null;
                cell.style.opacity = '1';
                cell.style.transform = '';
                
                const coords = getCellCoords(cell);
                if (coords) {
                    this.gameEngine.toggleFlag(coords.row, coords.col);
                    if (navigator.vibrate) navigator.vibrate(50);
                }
            }
        }, LONG_PRESS_DURATION);
    }, { passive: true });

    this.boardElement.addEventListener('touchmove', (e) => {
        if (!activeTouchCell) return;
        
        const currentX = e.touches[0]?.clientX ?? 0;
        const currentY = e.touches[0]?.clientY ?? 0;
        const deltaX = Math.abs(currentX - touchStartX);
        const deltaY = Math.abs(currentY - touchStartY);

        if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
            touchMoved = true;
            activeTouchCell.style.opacity = '1';
            activeTouchCell.style.transform = '';
            if (longPressTimer !== null) {
                window.clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
    }, { passive: true });

    this.boardElement.addEventListener('touchend', (e) => {
        isTouchActive = false;
        if (!activeTouchCell) return;
        
        const cell = activeTouchCell;
        activeTouchCell = null; // Clear reference

        if (this.gameEngine.getState().status !== 'playing') return;

        if (longPressTimer !== null) {
            window.clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        cell.style.opacity = '1';
        cell.style.transform = '';

        if (touchMoved) {
            touchMoved = false;
            actionPerformed = false;
            return;
        }

        if (actionPerformed) {
            actionPerformed = false;
            e.preventDefault();
            touchHandled = true;
            window.setTimeout(() => { touchHandled = false; }, 500);
            return;
        }

        e.preventDefault();
        touchHandled = true;
        window.setTimeout(() => { touchHandled = false; }, 500);

        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime;
        lastTapTime = now;

        const coords = getCellCoords(cell);

        if (coords) {
            if (timeSinceLastTap > 0 && timeSinceLastTap <= DOUBLE_TAP_WINDOW) {
                actionPerformed = true;
                this.gameEngine.chord(coords.row, coords.col);
            } else {
                actionPerformed = true;
                this.gameEngine.revealCell(coords.row, coords.col);
            }
        }
    }, { passive: false });

    this.boardElement.addEventListener('touchcancel', () => {
        isTouchActive = false;
        if (longPressTimer !== null) {
            window.clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        if (activeTouchCell) {
            activeTouchCell.style.opacity = '1';
            activeTouchCell.style.transform = '';
            activeTouchCell = null;
        }
        touchMoved = false;
        touchHandled = false;
        actionPerformed = false;
    });
  }

  /**
   * Create a single cell DOM element
   */
  private createCellElement(
    cell: Cell,
    row: number,
    col: number
  ): HTMLElement {
    const cellDiv = document.createElement('div');
    cellDiv.className = 'cell';
    cellDiv.id = `cell-${row}-${col}`;
    cellDiv.dataset.row = String(row);
    cellDiv.dataset.col = String(col);

    this.updateCellDisplay(cellDiv, cell);
    return cellDiv;
  }

  /**
   * Update a cell's visual representation
   */
  updateCell(row: number, col: number): void {
    const state = this.gameEngine.getState();
    const cell = state.board.cells[row][col];
    const cellElement = this.cellMap.get(`${row},${col}`);

    if (cellElement && cell) {
      this.updateCellDisplay(cellElement, cell);
    }

    // Update counter on flag change
    if (state.status === 'playing') {
      this.updateCounter(state.minesRemaining);
    }
  }

  /**
   * Update cell display content and styling
   */
  private updateCellDisplay(cellElement: HTMLElement, cell: Cell): void {
    cellElement.textContent = '';
    cellElement.className = 'cell';

    if (cell.isRevealed) {
      cellElement.classList.add('revealed');

      if (cell.isMine) {
        cellElement.textContent = '💣';
        cellElement.classList.add('mine');
      } else if (cell.adjacentMines > 0) {
        cellElement.textContent = String(cell.adjacentMines);
        cellElement.classList.add(`number-${cell.adjacentMines}`);
      }
    } else {
      cellElement.classList.add('unrevealed');

      if (cell.isFlagged) {
        cellElement.textContent = '🚩';
        cellElement.classList.add('flagged');
      } else if (this.learningModeEnabled) {
        // Show probability in learning mode
        const key = `${cell.row},${cell.col}`;
        const prob = this.probabilities[key];
        if (prob !== undefined) {
          const percentage = Math.round(prob * 100);
          const probSpan = document.createElement('span');
          probSpan.className = 'probability';
          probSpan.textContent = `${percentage}%`;
          
          // Color code based on probability
          if (prob === 0) {
            probSpan.classList.add('prob-safe');
          } else if (prob === 1.0) {
            probSpan.classList.add('prob-mine');
          } else if (prob < 0.3) {
            probSpan.classList.add('prob-low');
          } else if (prob < 0.7) {
            probSpan.classList.add('prob-medium');
          } else {
            probSpan.classList.add('prob-high');
          }
          
          cellElement.appendChild(probSpan);
        }
      }
    }
  }

  /**
   * Update timer display
   */
  private updateTimer(elapsedTime: number): void {
    if (this.timerElement) {
      const seconds = Math.min(elapsedTime, 9999);
      this.timerElement.textContent = String(seconds).padStart(3, '0');
    }
  }

  /**
   * Update mine counter display
   */
  private updateCounter(minesRemaining: number): void {
    if (this.counterElement) {
      const display = Math.max(0, Math.min(minesRemaining, 999));
      this.counterElement.textContent = String(display).padStart(3, '0');
    }
  }

  /**
   * Update info display
   */
  updateInfo(state: GameState): void {
    this.updateTimer(state.elapsedTime);
    this.updateCounter(state.minesRemaining);
    this.updateStatus(state.status);
  }

  /**
   * Update status display
   */
  private updateStatus(status: string): void {
    if (this.statusElement) {
      if (status === 'playing') {
        this.statusElement.textContent = '😊';
      } else if (status === 'won') {
        this.statusElement.textContent = '😎';
      } else if (status === 'lost') {
        this.statusElement.textContent = '😵';
      }
    }
  }

  /**
   * Handle game won
   */
  private onGameWon(data: any): void {
    this.updateStatus('won');
    if (this.boardElement) {
      this.boardElement.classList.add('game-won');
    }

    // Show victory message
    if (this.messageElement) {
      if (this.messageAlertElement) {
        this.messageAlertElement.textContent = `You won! Time: ${data.time}s ${data.hasUsedUndo ? '(with undo)' : ''}`;
      }
      this.messageElement.style.color = 'green';
      this.messageElement.classList.add('has-alert');
    }
  }

  /**
   * Handle game lost
   */
  private onGameLost(): void {
    this.updateStatus('lost');
    if (this.boardElement) {
      this.boardElement.classList.add('game-lost');
    }

    // Show loss message
    if (this.messageElement) {
      if (this.messageAlertElement) {
        this.messageAlertElement.textContent = 'Game Over! You hit a mine.';
      }
      this.messageElement.style.color = 'red';
      this.messageElement.classList.add('has-alert');
    }
  }

  /**
   * Clear messages
   */
  clearMessage(): void {
    if (this.messageElement) {
      if (this.messageAlertElement) {
        this.messageAlertElement.textContent = '';
      }
      this.messageElement.style.color = 'inherit';
      this.messageElement.classList.remove('has-alert');
    }

    if (this.boardElement) {
      this.boardElement.classList.remove('game-won', 'game-lost');
    }
  }

  /**
   * Disable board interaction
   */
  disableBoard(disabled: boolean = true): void {
    if (this.boardElement) {
      this.boardElement.style.pointerEvents = disabled ? 'none' : 'auto';
      this.boardElement.style.opacity = disabled ? '0.5' : '1';
    }
  }

  /**
   * Update probabilities (e.g., after a cell is revealed or flagged)
   */
  updateProbabilities(probabilities: ProbabilityMap): void {
    this.probabilities = probabilities;
    
    if (this.learningModeEnabled) {
      // Refresh all unrevealed cells
      const state = this.gameEngine.getState();
      for (let row = 0; row < state.board.rows; row++) {
        for (let col = 0; col < state.board.cols; col++) {
          const cell = state.board.cells[row][col];
          if (!cell.isRevealed && !cell.isFlagged) {
            this.updateCell(row, col);
          }
        }
      }
    }
  }

  /**
   * Enable or disable learning mode
   */
  setLearningMode(enabled: boolean, probabilities?: ProbabilityMap): void {
    this.learningModeEnabled = enabled;

    if (enabled && probabilities) {
      this.updateProbabilities(probabilities);
    } else if (!enabled) {
      this.probabilities = {};
      // Clear probabilities display
      const state = this.gameEngine.getState();
      for (let row = 0; row < state.board.rows; row++) {
        for (let col = 0; col < state.board.cols; col++) {
          const cell = state.board.cells[row][col];
          if (!cell.isRevealed && !cell.isFlagged) {
            const cellElement = this.cellMap.get(`${row},${col}`);
            if (cellElement) {
              // Remove probability spans
              const probSpan = cellElement.querySelector('.probability');
              if (probSpan) {
                cellElement.removeChild(probSpan);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    // Remove event listeners if needed
  }
}

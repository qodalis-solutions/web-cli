import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliManagedInterval,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

// -- Types ------------------------------------------------------------------

interface Cell {
    mine: boolean;
    revealed: boolean;
    flagged: boolean;
    adjacentMines: number;
}

type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
    rows: number;
    cols: number;
    mines: number;
    label: string;
}

interface BestTimes {
    easy: number | null;
    medium: number | null;
    hard: number | null;
}

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
    easy: { rows: 9, cols: 9, mines: 10, label: 'Easy' },
    medium: { rows: 16, cols: 16, mines: 40, label: 'Medium' },
    hard: { rows: 16, cols: 30, mines: 99, label: 'Hard' },
};

// -- ANSI helpers -----------------------------------------------------------

const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
    clearScreen: `${CSI}2J`,
    cursorHome: `${CSI}H`,
    hideCursor: `${CSI}?25l`,
    showCursor: `${CSI}?25h`,
    cursorTo: (row: number, col: number) => `${CSI}${row};${col}H`,
    fg: {
        blue: `${CSI}34m`,
        green: `${CSI}32m`,
        red: `${CSI}91m`,
        darkBlue: `${CSI}34;1m`,
        magenta: `${CSI}35m`,
        cyan: `${CSI}36m`,
        white: `${CSI}97m`,
        gray: `${CSI}90m`,
        yellow: `${CSI}93m`,
        brightRed: `${CSI}91;1m`,
    },
    bg: {
        red: `${CSI}41m`,
        brightRed: `${CSI}101m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    inverse: `${CSI}7m`,
    reset: `${CSI}0m`,
};

// Number color mapping: 1=blue, 2=green, 3=red, 4=dark blue, 5=magenta, 6=cyan, 7=white, 8=gray
const NUMBER_COLORS: Record<number, string> = {
    1: ansi.fg.blue,
    2: ansi.fg.green,
    3: ansi.fg.red,
    4: ansi.fg.darkBlue,
    5: ansi.fg.magenta,
    6: ansi.fg.cyan,
    7: ansi.fg.white,
    8: ansi.fg.gray,
};

// Box-drawing characters
const BOX = {
    topLeft: '\u250C',     // +
    topRight: '\u2510',    // +
    bottomLeft: '\u2514',  // +
    bottomRight: '\u2518', // +
    horizontal: '\u2500',  // -
    vertical: '\u2502',    // |
};

// Cell display characters
const HIDDEN_CHAR = '\u25A0';  // filled square
const FLAG_CHAR = '\u2691';    // flag
const MINE_CHAR = '*';
const EXPLODED_CHAR = 'X';

// -- Processor --------------------------------------------------------------

export class CliMinesweeperCommandProcessor implements ICliCommandProcessor {
    command = 'minesweeper';

    description = 'Play Minesweeper in your terminal';

    aliases = ['mines', 'sweep'];

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        module: 'games',
        icon: '\uD83D\uDCA3', // bomb emoji
        requiredCoreVersion: '0.0.16',
        requiredCliVersion: '1.0.37',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            minesweeperBestTimes: { easy: null, medium: null, hard: null },
        },
    };

    // -- Game state ---------------------------------------------------------

    private grid: Cell[][] = [];
    private gridRows = 0;
    private gridCols = 0;
    private totalMines = 0;
    private difficulty: Difficulty = 'easy';
    private cursorRow = 0;
    private cursorCol = 0;
    private gameOver = false;
    private gameWon = false;
    private firstReveal = true;
    private startTime = 0;
    private elapsedSeconds = 0;
    private timerHandle: ICliManagedInterval | null = null;
    private flagCount = 0;
    private explodedRow = -1;
    private explodedCol = -1;
    private bestTimes: BestTimes = { easy: null, medium: null, hard: null };
    private context: ICliExecutionContext | null = null;

    // Offset for centering the grid in the terminal
    private offsetX = 0;
    private offsetY = 0;

    constructor() {
        this.registerSubProcessors();
    }

    // -- Lifecycle ----------------------------------------------------------

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<BestTimes>((x) => x['minesweeperBestTimes'])
            .subscribe((times) => {
                this.bestTimes = times ?? { easy: null, medium: null, hard: null };
            });
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        this.context = context;
        this.difficulty = 'easy';
        this.startGame(context);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.gameOver || this.gameWon) {
            this.handleGameOverInput(data, context);
            return;
        }

        switch (data) {
            // Arrow keys
            case `${ESC}[A`: // Up
            case 'w':
            case 'W':
                this.moveCursor(-1, 0);
                break;
            case `${ESC}[B`: // Down
            case 's':
            case 'S':
                this.moveCursor(1, 0);
                break;
            case `${ESC}[D`: // Left
            case 'a':
            case 'A':
                this.moveCursor(0, -1);
                break;
            case `${ESC}[C`: // Right
            case 'd':
            case 'D':
                this.moveCursor(0, 1);
                break;

            // Reveal cell
            case '\r': // Enter
            case ' ':  // Space
                this.revealCell(this.cursorRow, this.cursorCol, context);
                break;

            // Flag cell
            case 'f':
            case 'F':
                this.toggleFlag(this.cursorRow, this.cursorCol);
                break;

            // Quit
            case ESC:
                this.stopGame(context);
                return;
        }

        this.render(context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('minesweeper', CliForegroundColor.Cyan)}             Start easy game (9x9, 10 mines)`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('minesweeper easy', CliForegroundColor.Cyan)}        Easy: 9x9, 10 mines`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('minesweeper medium', CliForegroundColor.Cyan)}      Medium: 16x16, 40 mines`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('minesweeper hard', CliForegroundColor.Cyan)}        Hard: 16x30, 99 mines`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('minesweeper scores', CliForegroundColor.Cyan)}      View best times`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('minesweeper reset', CliForegroundColor.Cyan)}       Reset best times`,
        );
        writer.writeln();
        writer.writeln('Controls:');
        writer.writeln(
            `  ${writer.wrapInColor('Arrow keys / WASD', CliForegroundColor.Yellow)}  Move cursor`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Enter / Space', CliForegroundColor.Yellow)}      Reveal cell`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('F', CliForegroundColor.Yellow)}                  Flag / Unflag cell`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('R', CliForegroundColor.Yellow)}                  Restart (after game over)`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Esc', CliForegroundColor.Yellow)}                Quit game`,
        );
    }

    // -- Sub-processors -----------------------------------------------------

    private registerSubProcessors(): void {
        this.processors = [
            // Difficulty sub-processors
            {
                command: 'easy',
                description: 'Start an easy game (9x9, 10 mines)',
                processCommand: async (_, context) => {
                    this.context = context;
                    this.difficulty = 'easy';
                    this.startGame(context);
                },
            },
            {
                command: 'medium',
                description: 'Start a medium game (16x16, 40 mines)',
                processCommand: async (_, context) => {
                    this.context = context;
                    this.difficulty = 'medium';
                    this.startGame(context);
                },
            },
            {
                command: 'hard',
                description: 'Start a hard game (16x30, 99 mines)',
                processCommand: async (_, context) => {
                    this.context = context;
                    this.difficulty = 'hard';
                    this.startGame(context);
                },
            },
            // Scores
            {
                command: 'scores',
                description: 'View best times for each difficulty',
                processCommand: async (_, context) => {
                    const { writer } = context;
                    writer.writeln();
                    writer.writeln(
                        writer.wrapInColor(
                            '  MINESWEEPER BEST TIMES',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    writer.writeln();

                    for (const diff of ['easy', 'medium', 'hard'] as Difficulty[]) {
                        const config = DIFFICULTIES[diff];
                        const best = this.bestTimes[diff];
                        const timeStr = best !== null
                            ? this.formatTime(best)
                            : 'No record';
                        writer.writeln(
                            `  ${writer.wrapInColor(config.label.padEnd(8), CliForegroundColor.Cyan)}  ${writer.wrapInColor(`${config.rows}x${config.cols}`, CliForegroundColor.White)}  ${timeStr}`,
                        );
                    }
                    writer.writeln();
                },
            },
            // Reset
            {
                command: 'reset',
                description: 'Reset all best times',
                processCommand: async (_, context) => {
                    this.bestTimes = { easy: null, medium: null, hard: null };
                    context.state.updateState({
                        minesweeperBestTimes: this.bestTimes,
                    });
                    await context.state.persist();
                    context.writer.writeSuccess('Best times have been reset.');
                },
            },
        ];
    }

    // -- Game lifecycle -----------------------------------------------------

    private startGame(context: ICliExecutionContext): void {
        this.resetGameState();
        this.computeLayout(context);

        context.enterFullScreenMode(this);
        this.startTimer(context);
        this.render(context);
    }

    private stopGame(context: ICliExecutionContext): void {
        this.stopTimer();
        context.exitFullScreenMode();
        this.context = null;
    }

    onResize(
        cols: number,
        rows: number,
        context: ICliExecutionContext,
    ): void {
        this.computeLayout(context);
        this.render(context);
    }

    onDispose(context: ICliExecutionContext): void {
        this.stopTimer();
    }

    private resetGameState(): void {
        const config = DIFFICULTIES[this.difficulty];
        this.gridRows = config.rows;
        this.gridCols = config.cols;
        this.totalMines = config.mines;

        // Initialize empty grid
        this.grid = [];
        for (let r = 0; r < this.gridRows; r++) {
            const row: Cell[] = [];
            for (let c = 0; c < this.gridCols; c++) {
                row.push({
                    mine: false,
                    revealed: false,
                    flagged: false,
                    adjacentMines: 0,
                });
            }
            this.grid.push(row);
        }

        this.cursorRow = Math.floor(this.gridRows / 2);
        this.cursorCol = Math.floor(this.gridCols / 2);
        this.gameOver = false;
        this.gameWon = false;
        this.firstReveal = true;
        this.startTime = 0;
        this.elapsedSeconds = 0;
        this.flagCount = 0;
        this.explodedRow = -1;
        this.explodedCol = -1;
    }

    private computeLayout(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;

        // Each cell is 3 chars wide, plus 2 for borders
        const gridDisplayWidth = this.gridCols * 3 + 2;
        // Grid height plus 2 for borders, plus title row, plus HUD rows
        const gridDisplayHeight = this.gridRows + 2;

        // Center horizontally
        this.offsetX = Math.max(1, Math.floor((cols - gridDisplayWidth) / 2));
        // Center vertically (with room for HUD below)
        this.offsetY = Math.max(1, Math.floor((rows - gridDisplayHeight - 4) / 2));
    }

    // -- Timer --------------------------------------------------------------

    private startTimer(context: ICliExecutionContext): void {
        this.stopTimer();
        this.startTime = Date.now();
        this.elapsedSeconds = 0;

        this.timerHandle = context.createInterval(() => {
            if (!this.gameOver && !this.gameWon && !this.firstReveal) {
                const prev = this.elapsedSeconds;
                this.elapsedSeconds = Math.floor(
                    (Date.now() - this.startTime) / 1000,
                );
                if (this.elapsedSeconds !== prev && this.context) {
                    this.render(this.context);
                }
            }
        }, 500);
    }

    private stopTimer(): void {
        if (this.timerHandle !== null) {
            this.timerHandle.clear();
            this.timerHandle = null;
        }
    }

    // -- Mine placement (deferred until first click) ------------------------

    private placeMines(safeRow: number, safeCol: number): void {
        // Collect all positions except the safe cell and its neighbors
        const forbidden = new Set<string>();
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = safeRow + dr;
                const nc = safeCol + dc;
                if (nr >= 0 && nr < this.gridRows && nc >= 0 && nc < this.gridCols) {
                    forbidden.add(`${nr},${nc}`);
                }
            }
        }

        const candidates: [number, number][] = [];
        for (let r = 0; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                if (!forbidden.has(`${r},${c}`)) {
                    candidates.push([r, c]);
                }
            }
        }

        // Fisher-Yates shuffle and pick first N
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        const mineCount = Math.min(this.totalMines, candidates.length);
        for (let i = 0; i < mineCount; i++) {
            const [r, c] = candidates[i];
            this.grid[r][c].mine = true;
        }

        // Compute adjacent mine counts
        for (let r = 0; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                if (this.grid[r][c].mine) continue;
                let count = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr;
                        const nc = c + dc;
                        if (
                            nr >= 0 &&
                            nr < this.gridRows &&
                            nc >= 0 &&
                            nc < this.gridCols &&
                            this.grid[nr][nc].mine
                        ) {
                            count++;
                        }
                    }
                }
                this.grid[r][c].adjacentMines = count;
            }
        }
    }

    // -- Cursor movement ----------------------------------------------------

    private moveCursor(dr: number, dc: number): void {
        const newRow = this.cursorRow + dr;
        const newCol = this.cursorCol + dc;
        if (
            newRow >= 0 &&
            newRow < this.gridRows &&
            newCol >= 0 &&
            newCol < this.gridCols
        ) {
            this.cursorRow = newRow;
            this.cursorCol = newCol;
        }
    }

    // -- Cell reveal --------------------------------------------------------

    private revealCell(
        row: number,
        col: number,
        context: ICliExecutionContext,
    ): void {
        const cell = this.grid[row][col];
        if (cell.revealed || cell.flagged) return;

        // First reveal: place mines, start timer
        if (this.firstReveal) {
            this.placeMines(row, col);
            this.firstReveal = false;
            this.startTime = Date.now();
            this.elapsedSeconds = 0;
        }

        if (cell.mine) {
            // Game over
            this.explodedRow = row;
            this.explodedCol = col;
            this.handleGameOver(context);
            return;
        }

        // Flood-fill reveal
        this.floodReveal(row, col);

        // Check win
        if (this.checkWin()) {
            this.handleWin(context);
        }
    }

    private floodReveal(row: number, col: number): void {
        const stack: [number, number][] = [[row, col]];

        while (stack.length > 0) {
            const [r, c] = stack.pop()!;
            const cell = this.grid[r][c];

            if (cell.revealed || cell.flagged || cell.mine) continue;

            cell.revealed = true;

            // If empty cell (0 adjacent mines), reveal neighbors
            if (cell.adjacentMines === 0) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr;
                        const nc = c + dc;
                        if (
                            nr >= 0 &&
                            nr < this.gridRows &&
                            nc >= 0 &&
                            nc < this.gridCols &&
                            !this.grid[nr][nc].revealed
                        ) {
                            stack.push([nr, nc]);
                        }
                    }
                }
            }
        }
    }

    // -- Flag toggle --------------------------------------------------------

    private toggleFlag(row: number, col: number): void {
        const cell = this.grid[row][col];
        if (cell.revealed) return;

        if (cell.flagged) {
            cell.flagged = false;
            this.flagCount--;
        } else {
            cell.flagged = true;
            this.flagCount++;
        }
    }

    // -- Win / Game Over ----------------------------------------------------

    private checkWin(): boolean {
        for (let r = 0; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                const cell = this.grid[r][c];
                if (!cell.mine && !cell.revealed) return false;
            }
        }
        return true;
    }

    private async handleWin(context: ICliExecutionContext): Promise<void> {
        this.gameWon = true;
        this.stopTimer();

        // Update elapsed to final value
        this.elapsedSeconds = Math.floor(
            (Date.now() - this.startTime) / 1000,
        );

        // Auto-flag all remaining mines
        for (let r = 0; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                if (this.grid[r][c].mine && !this.grid[r][c].flagged) {
                    this.grid[r][c].flagged = true;
                    this.flagCount++;
                }
            }
        }

        // Save best time
        const currentBest = this.bestTimes[this.difficulty];
        if (currentBest === null || this.elapsedSeconds < currentBest) {
            this.bestTimes[this.difficulty] = this.elapsedSeconds;
            context.state.updateState({
                minesweeperBestTimes: { ...this.bestTimes },
            });
            await context.state.persist();
        }

        this.render(context);
    }

    private async handleGameOver(
        context: ICliExecutionContext,
    ): Promise<void> {
        this.gameOver = true;
        this.stopTimer();

        // Update elapsed to final value
        this.elapsedSeconds = Math.floor(
            (Date.now() - this.startTime) / 1000,
        );

        // Reveal all mines
        for (let r = 0; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                if (this.grid[r][c].mine) {
                    this.grid[r][c].revealed = true;
                }
            }
        }

        this.render(context);
    }

    private handleGameOverInput(
        data: string,
        context: ICliExecutionContext,
    ): void {
        switch (data) {
            case 'r':
            case 'R':
                this.resetGameState();
                this.computeLayout(context);
                this.startTimer(context);
                this.render(context);
                break;
            case 'q':
            case 'Q':
            case ESC:
                this.stopGame(context);
                break;
        }
    }

    // -- Rendering ----------------------------------------------------------

    private render(context: ICliExecutionContext): void {
        const buf: string[] = [];

        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        // -- Title bar ------------------------------------------------------
        const config = DIFFICULTIES[this.difficulty];
        const title = ` MINESWEEPER - ${config.label} `;
        const gridDisplayWidth = this.gridCols * 3;
        const titlePad = Math.max(
            0,
            Math.floor((gridDisplayWidth - title.length) / 2),
        );

        buf.push(ansi.cursorTo(this.offsetY, this.offsetX));
        buf.push(
            ansi.fg.cyan,
            BOX.topLeft,
            BOX.horizontal.repeat(titlePad),
            ansi.bold,
            ansi.fg.yellow,
            title,
            ansi.reset,
            ansi.fg.cyan,
            BOX.horizontal.repeat(
                Math.max(0, gridDisplayWidth - titlePad - title.length),
            ),
            BOX.topRight,
            ansi.reset,
        );

        // -- Grid rows ------------------------------------------------------
        for (let r = 0; r < this.gridRows; r++) {
            const row = this.offsetY + 1 + r;
            buf.push(ansi.cursorTo(row, this.offsetX));
            buf.push(ansi.fg.cyan, BOX.vertical, ansi.reset);

            for (let c = 0; c < this.gridCols; c++) {
                const cell = this.grid[r][c];
                const isCursor =
                    r === this.cursorRow && c === this.cursorCol;
                const isExploded =
                    r === this.explodedRow && c === this.explodedCol;

                let cellStr: string;

                if (isExploded && this.gameOver) {
                    // The mine that was clicked - bright red background
                    cellStr = `${ansi.bg.brightRed}${ansi.fg.white}${ansi.bold} ${EXPLODED_CHAR} ${ansi.reset}`;
                } else if (cell.revealed) {
                    if (cell.mine) {
                        // Revealed mine (game over, show all mines)
                        cellStr = `${ansi.fg.red}${ansi.bold} ${MINE_CHAR} ${ansi.reset}`;
                    } else if (cell.adjacentMines > 0) {
                        // Number
                        const color =
                            NUMBER_COLORS[cell.adjacentMines] || ansi.fg.white;
                        cellStr = `${color}${ansi.bold} ${cell.adjacentMines} ${ansi.reset}`;
                    } else {
                        // Empty revealed cell
                        cellStr = '   ';
                    }
                } else if (cell.flagged) {
                    cellStr = `${ansi.fg.red}${ansi.bold} ${FLAG_CHAR} ${ansi.reset}`;
                } else {
                    // Hidden cell
                    cellStr = `${ansi.fg.gray} ${HIDDEN_CHAR} ${ansi.reset}`;
                }

                // Apply cursor highlight (inverse)
                if (isCursor && !this.gameOver && !this.gameWon) {
                    buf.push(ansi.inverse, cellStr, ansi.reset);
                } else {
                    buf.push(cellStr);
                }
            }

            buf.push(ansi.fg.cyan, BOX.vertical, ansi.reset);
        }

        // -- Bottom border --------------------------------------------------
        const bottomRow = this.offsetY + 1 + this.gridRows;
        buf.push(ansi.cursorTo(bottomRow, this.offsetX));
        buf.push(
            ansi.fg.cyan,
            BOX.bottomLeft,
            BOX.horizontal.repeat(gridDisplayWidth),
            BOX.bottomRight,
            ansi.reset,
        );

        // -- HUD ------------------------------------------------------------
        const hudRow = bottomRow + 1;
        const minesRemaining = this.totalMines - this.flagCount;
        const timeStr = this.formatTime(this.elapsedSeconds);
        const bestTime = this.bestTimes[this.difficulty];
        const bestStr =
            bestTime !== null ? this.formatTime(bestTime) : '--:--';

        buf.push(ansi.cursorTo(hudRow, this.offsetX));
        buf.push(
            ansi.fg.white,
            '  ',
            ansi.fg.red,
            ansi.bold,
            '\uD83D\uDCA3 ',
            `${minesRemaining}`,
            ansi.reset,
            ansi.fg.gray,
            '  |  ',
            ansi.fg.white,
            '\u23F1 ',
            timeStr,
            ansi.fg.gray,
            '  |  ',
            'Best: ',
            ansi.fg.yellow,
            bestStr,
            ansi.fg.gray,
            '  |  ',
            config.label,
            ` (${config.rows}x${config.cols})`,
            ansi.reset,
        );

        // -- Controls hint --------------------------------------------------
        buf.push(ansi.cursorTo(hudRow + 1, this.offsetX));
        buf.push(
            ansi.dim,
            '  [WASD/Arrows] Move  [Enter/Space] Reveal  [F] Flag  [Esc] Quit',
            ansi.reset,
        );

        // -- Game over overlay ----------------------------------------------
        if (this.gameOver) {
            this.renderGameOverOverlay(buf);
        }

        // -- Win overlay ----------------------------------------------------
        if (this.gameWon) {
            this.renderWinOverlay(buf);
        }

        context.terminal.write(buf.join(''));
    }

    private renderGameOverOverlay(buf: string[]): void {
        const centerY = this.offsetY + Math.floor(this.gridRows / 2);
        const boxWidth = 24;
        const gridDisplayWidth = this.gridCols * 3 + 2;
        const boxLeft =
            this.offsetX + Math.floor((gridDisplayWidth - boxWidth) / 2);

        buf.push(ansi.cursorTo(centerY - 2, boxLeft));
        buf.push(
            ansi.fg.red,
            BOX.topLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.topRight,
        );

        buf.push(ansi.cursorTo(centerY - 1, boxLeft));
        buf.push(BOX.vertical);
        const gameOverText = '    GAME OVER!      ';
        buf.push(
            ansi.bold,
            gameOverText.padEnd(boxWidth - 2),
            ansi.reset,
            ansi.fg.red,
        );
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY, boxLeft));
        buf.push(BOX.vertical);
        const timeText = `    Time: ${this.formatTime(this.elapsedSeconds)}`;
        buf.push(
            ansi.reset,
            ansi.fg.yellow,
            timeText.padEnd(boxWidth - 2),
            ansi.fg.red,
        );
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY + 1, boxLeft));
        buf.push(BOX.vertical);
        buf.push(
            ansi.reset,
            ansi.dim,
            '  [R] Retry [Q] Quit',
            ansi.reset,
            ansi.fg.red,
            ' '.repeat(Math.max(0, boxWidth - 2 - 20)),
        );
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY + 2, boxLeft));
        buf.push(
            BOX.bottomLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.bottomRight,
            ansi.reset,
        );
    }

    private renderWinOverlay(buf: string[]): void {
        const centerY = this.offsetY + Math.floor(this.gridRows / 2);
        const boxWidth = 26;
        const gridDisplayWidth = this.gridCols * 3 + 2;
        const boxLeft =
            this.offsetX + Math.floor((gridDisplayWidth - boxWidth) / 2);

        const currentBest = this.bestTimes[this.difficulty];
        const isNewRecord =
            currentBest !== null && currentBest === this.elapsedSeconds;

        const borderColor = ansi.fg.green;

        buf.push(ansi.cursorTo(centerY - 2, boxLeft));
        buf.push(
            borderColor,
            BOX.topLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.topRight,
        );

        buf.push(ansi.cursorTo(centerY - 1, boxLeft));
        buf.push(BOX.vertical);
        const winText = isNewRecord
            ? '  NEW RECORD! YOU WIN!'
            : '      YOU WIN!        ';
        buf.push(
            ansi.bold,
            ansi.fg.yellow,
            winText.padEnd(boxWidth - 2),
            ansi.reset,
            borderColor,
        );
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY, boxLeft));
        buf.push(BOX.vertical);
        const timeText = `    Time: ${this.formatTime(this.elapsedSeconds)}`;
        buf.push(
            ansi.reset,
            ansi.fg.white,
            timeText.padEnd(boxWidth - 2),
            borderColor,
        );
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY + 1, boxLeft));
        buf.push(BOX.vertical);
        buf.push(
            ansi.reset,
            ansi.dim,
            '  [R] New Game [Q] Quit',
            ansi.reset,
            borderColor,
            ' '.repeat(Math.max(0, boxWidth - 2 - 23)),
        );
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY + 2, boxLeft));
        buf.push(
            BOX.bottomLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.bottomRight,
            ansi.reset,
        );
    }

    // -- Helpers ------------------------------------------------------------

    private formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}

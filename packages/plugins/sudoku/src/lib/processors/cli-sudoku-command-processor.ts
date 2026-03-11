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

type Grid = number[][]; // 0 = empty, 1-9 = value
type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
    clues: number; // how many cells are pre-filled
    label: string;
}

interface BestTime {
    time: number;
    date: string;
}

interface BestTimes {
    easy: BestTime | null;
    medium: BestTime | null;
    hard: BestTime | null;
}

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
    easy: { clues: 38, label: 'Easy' },
    medium: { clues: 30, label: 'Medium' },
    hard: { clues: 24, label: 'Hard' },
};

const SIZE = 9;
const BOX_SIZE = 3;

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
        white: `${CSI}97m`,
        cyan: `${CSI}36m`,
        yellow: `${CSI}93m`,
        green: `${CSI}32m`,
        magenta: `${CSI}35m`,
        red: `${CSI}91m`,
        blue: `${CSI}34m`,
        gray: `${CSI}90m`,
        brightCyan: `${CSI}96m`,
        brightGreen: `${CSI}92m`,
    },
    bg: {
        darkGray: `${CSI}48;5;236m`,
        blue: `${CSI}44m`,
        red: `${CSI}41m`,
        green: `${CSI}42m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    inverse: `${CSI}7m`,
    reset: `${CSI}0m`,
};

// Box-drawing characters
const BOX = {
    topLeft: '\u250C',
    topRight: '\u2510',
    bottomLeft: '\u2514',
    bottomRight: '\u2518',
    horizontal: '\u2500',
    vertical: '\u2502',
    doubleHorizontal: '\u2550',
    doubleVertical: '\u2551',
    doubleTopLeft: '\u2554',
    doubleTopRight: '\u2557',
    doubleBottomLeft: '\u255A',
    doubleBottomRight: '\u255D',
    doubleTeeRight: '\u2560',
    doubleTeeLeft: '\u2563',
    doubleCross: '\u256C',
};

// -- Sudoku Generator -------------------------------------------------------

function generateSolution(): Grid {
    const grid: Grid = Array.from({ length: SIZE }, () =>
        new Array(SIZE).fill(0),
    );

    function isValid(grid: Grid, row: number, col: number, num: number): boolean {
        for (let c = 0; c < SIZE; c++) {
            if (grid[row][c] === num) return false;
        }
        for (let r = 0; r < SIZE; r++) {
            if (grid[r][col] === num) return false;
        }
        const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
        const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
        for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
            for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
                if (grid[r][c] === num) return false;
            }
        }
        return true;
    }

    function solve(grid: Grid): boolean {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c] === 0) {
                    // Randomized number order for generation
                    const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (const num of nums) {
                        if (isValid(grid, r, c, num)) {
                            grid[r][c] = num;
                            if (solve(grid)) return true;
                            grid[r][c] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    solve(grid);
    return grid;
}

function countSolutions(grid: Grid, limit: number): number {
    function isValid(grid: Grid, row: number, col: number, num: number): boolean {
        for (let c = 0; c < SIZE; c++) {
            if (grid[row][c] === num) return false;
        }
        for (let r = 0; r < SIZE; r++) {
            if (grid[r][col] === num) return false;
        }
        const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
        const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
        for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
            for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
                if (grid[r][c] === num) return false;
            }
        }
        return true;
    }

    let count = 0;

    function solve(grid: Grid): boolean {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c] === 0) {
                    for (let num = 1; num <= 9; num++) {
                        if (isValid(grid, r, c, num)) {
                            grid[r][c] = num;
                            if (solve(grid)) return true;
                            grid[r][c] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        count++;
        return count >= limit;
    }

    solve(grid);
    return count;
}

function generatePuzzle(difficulty: Difficulty): { puzzle: Grid; solution: Grid } {
    const solution = generateSolution();
    const puzzle = solution.map((row) => [...row]);

    const config = DIFFICULTIES[difficulty];
    const cellsToRemove = SIZE * SIZE - config.clues;

    // Collect all positions and shuffle
    const positions: [number, number][] = [];
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            positions.push([r, c]);
        }
    }
    shuffleArray(positions);

    let removed = 0;
    for (const [r, c] of positions) {
        if (removed >= cellsToRemove) break;

        const saved = puzzle[r][c];
        puzzle[r][c] = 0;

        // Verify puzzle still has a unique solution
        const testGrid = puzzle.map((row) => [...row]);
        if (countSolutions(testGrid, 2) !== 1) {
            puzzle[r][c] = saved; // restore — removing this cell creates ambiguity
            continue;
        }

        removed++;
    }

    return { puzzle, solution };
}

function shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// -- Processor --------------------------------------------------------------

export class CliSudokuCommandProcessor implements ICliCommandProcessor {
    command = 'sudoku';

    description = 'Play Sudoku in your terminal';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        module: 'games',
        icon: '\uD83E\uDDE9', // puzzle piece
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            sudokuBestTimes: { easy: null, medium: null, hard: null },
        },
    };

    // -- Game state ---------------------------------------------------------

    private puzzle: Grid = [];
    private solution: Grid = [];
    private playerGrid: Grid = []; // current state including player entries
    private given: boolean[][] = []; // true if cell was pre-filled (immutable)
    private notes: Set<number>[][] = []; // pencil marks per cell

    private cursorRow = 0;
    private cursorCol = 0;
    private difficulty: Difficulty = 'easy';
    private gameOver = false;
    private gameWon = false;
    private notesMode = false;
    private errors = 0;
    private startTime = 0;
    private elapsedSeconds = 0;
    private timerHandle: ICliManagedInterval | null = null;
    private bestTimes: BestTimes = { easy: null, medium: null, hard: null };
    private context: ICliExecutionContext | null = null;

    // Layout
    private offsetX = 0;
    private offsetY = 0;

    constructor() {
        this.registerSubProcessors();
    }

    // -- Lifecycle ----------------------------------------------------------

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<BestTimes>((x) => x['sudokuBestTimes'])
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

            // Number input 1-9
            case '1': case '2': case '3':
            case '4': case '5': case '6':
            case '7': case '8': case '9':
                this.handleNumberInput(parseInt(data, 10), context);
                break;

            // Delete / clear cell
            case '\x7f': // Backspace
            case '\b':
            case '0':
            case `${ESC}[3~`: // Delete key
                this.clearCell();
                break;

            // Toggle notes mode
            case 'n':
            case 'N':
                this.notesMode = !this.notesMode;
                break;

            // Check puzzle
            case 'c':
            case 'C':
                this.checkPuzzle(context);
                break;

            // Hint
            case 'h':
            case 'H':
                this.giveHint();
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
            `  ${writer.wrapInColor('sudoku', CliForegroundColor.Cyan)}              Start an easy game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('sudoku easy', CliForegroundColor.Cyan)}         Easy: 38 clues`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('sudoku medium', CliForegroundColor.Cyan)}       Medium: 30 clues`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('sudoku hard', CliForegroundColor.Cyan)}         Hard: 24 clues`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('sudoku scores', CliForegroundColor.Cyan)}       View best times`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('sudoku reset', CliForegroundColor.Cyan)}        Reset best times`,
        );
        writer.writeln();
        writer.writeln('Controls:');
        writer.writeln(
            `  ${writer.wrapInColor('Arrow keys / WASD', CliForegroundColor.Yellow)}  Move cursor`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('1-9', CliForegroundColor.Yellow)}                Enter number`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('0 / Backspace', CliForegroundColor.Yellow)}      Clear cell`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('N', CliForegroundColor.Yellow)}                  Toggle notes mode`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('H', CliForegroundColor.Yellow)}                  Hint (reveal cell)`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('C', CliForegroundColor.Yellow)}                  Check for errors`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Esc', CliForegroundColor.Yellow)}                Quit game`,
        );
    }

    // -- Sub-processors -----------------------------------------------------

    private registerSubProcessors(): void {
        this.processors = [
            {
                command: 'easy',
                description: 'Start an easy game (38 clues)',
                processCommand: async (_, context) => {
                    this.context = context;
                    this.difficulty = 'easy';
                    this.startGame(context);
                },
            },
            {
                command: 'medium',
                description: 'Start a medium game (30 clues)',
                processCommand: async (_, context) => {
                    this.context = context;
                    this.difficulty = 'medium';
                    this.startGame(context);
                },
            },
            {
                command: 'hard',
                description: 'Start a hard game (24 clues)',
                processCommand: async (_, context) => {
                    this.context = context;
                    this.difficulty = 'hard';
                    this.startGame(context);
                },
            },
            {
                command: 'scores',
                description: 'View best times for each difficulty',
                processCommand: async (_, context) => {
                    const { writer } = context;
                    writer.writeln();
                    writer.writeln(
                        writer.wrapInColor(
                            '  SUDOKU BEST TIMES',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    writer.writeln();

                    for (const diff of ['easy', 'medium', 'hard'] as Difficulty[]) {
                        const config = DIFFICULTIES[diff];
                        const best = this.bestTimes[diff];
                        const timeStr = best !== null
                            ? `${this.formatTime(best.time)}  ${best.date}`
                            : 'No record';
                        writer.writeln(
                            `  ${writer.wrapInColor(config.label.padEnd(8), CliForegroundColor.Cyan)}  ${writer.wrapInColor(`${config.clues} clues`, CliForegroundColor.White)}  ${timeStr}`,
                        );
                    }
                    writer.writeln();
                },
            },
            {
                command: 'reset',
                description: 'Reset all best times',
                processCommand: async (_, context) => {
                    this.bestTimes = { easy: null, medium: null, hard: null };
                    context.state.updateState({
                        sudokuBestTimes: this.bestTimes,
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

    onDispose(_context: ICliExecutionContext): void {
        this.stopTimer();
    }

    private resetGameState(): void {
        const { puzzle, solution } = generatePuzzle(this.difficulty);
        this.puzzle = puzzle;
        this.solution = solution;
        this.playerGrid = puzzle.map((row) => [...row]);
        this.given = puzzle.map((row) => row.map((v) => v !== 0));
        this.notes = Array.from({ length: SIZE }, () =>
            Array.from({ length: SIZE }, () => new Set<number>()),
        );

        this.cursorRow = 0;
        this.cursorCol = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.notesMode = false;
        this.errors = 0;
        this.startTime = 0;
        this.elapsedSeconds = 0;
    }

    private computeLayout(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;

        // Cell row: doubleVertical + 9*(3 chars) + 6 thin separators + 2 double separators + doubleVertical = 37
        const gridWidth = 1 + SIZE * 3 + (SIZE - 1) + 1; // = 37
        // Grid height: 1 title + 9 cell rows + 8 separator rows + 1 bottom border = 19
        const gridHeight = 1 + SIZE + (SIZE - 1) + 1;

        this.offsetX = Math.max(1, Math.floor((cols - gridWidth) / 2));
        this.offsetY = Math.max(1, Math.floor((rows - gridHeight - 5) / 2));
    }

    // -- Timer --------------------------------------------------------------

    private startTimer(context: ICliExecutionContext): void {
        this.stopTimer();
        this.startTime = Date.now();
        this.elapsedSeconds = 0;

        this.timerHandle = context.createInterval(() => {
            if (!this.gameOver && !this.gameWon) {
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

    // -- Cursor movement ----------------------------------------------------

    private moveCursor(dr: number, dc: number): void {
        const newRow = this.cursorRow + dr;
        const newCol = this.cursorCol + dc;
        if (newRow >= 0 && newRow < SIZE && newCol >= 0 && newCol < SIZE) {
            this.cursorRow = newRow;
            this.cursorCol = newCol;
        }
    }

    // -- Input handling -----------------------------------------------------

    private handleNumberInput(num: number, context: ICliExecutionContext): void {
        const r = this.cursorRow;
        const c = this.cursorCol;

        if (this.given[r][c]) return; // can't modify given cells

        if (this.notesMode) {
            // Toggle note
            if (this.notes[r][c].has(num)) {
                this.notes[r][c].delete(num);
            } else {
                this.notes[r][c].add(num);
            }
            // Clear cell value when adding notes
            this.playerGrid[r][c] = 0;
        } else {
            this.playerGrid[r][c] = num;
            this.notes[r][c].clear(); // clear notes when placing a number

            // Check if puzzle is complete
            if (this.isPuzzleComplete()) {
                if (this.isPuzzleCorrect()) {
                    this.handleWin(context);
                }
            }
        }
    }

    private clearCell(): void {
        const r = this.cursorRow;
        const c = this.cursorCol;

        if (this.given[r][c]) return;

        this.playerGrid[r][c] = 0;
        this.notes[r][c].clear();
    }

    private giveHint(): void {
        const r = this.cursorRow;
        const c = this.cursorCol;

        if (this.given[r][c]) return;
        if (this.playerGrid[r][c] === this.solution[r][c]) return;

        this.playerGrid[r][c] = this.solution[r][c];
        this.given[r][c] = true; // mark as given so it can't be changed
        this.notes[r][c].clear();
    }

    private checkPuzzle(context: ICliExecutionContext): void {
        this.errors = 0;
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (
                    this.playerGrid[r][c] !== 0 &&
                    !this.given[r][c] &&
                    this.playerGrid[r][c] !== this.solution[r][c]
                ) {
                    this.errors++;
                }
            }
        }

        if (this.isPuzzleComplete() && this.isPuzzleCorrect()) {
            this.handleWin(context);
        }
    }

    // -- Win / Game state ---------------------------------------------------

    private isPuzzleComplete(): boolean {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (this.playerGrid[r][c] === 0) return false;
            }
        }
        return true;
    }

    private isPuzzleCorrect(): boolean {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (this.playerGrid[r][c] !== this.solution[r][c]) return false;
            }
        }
        return true;
    }

    private async handleWin(context: ICliExecutionContext): Promise<void> {
        this.gameWon = true;
        this.stopTimer();
        this.elapsedSeconds = Math.floor(
            (Date.now() - this.startTime) / 1000,
        );

        // Save best time
        const currentBest = this.bestTimes[this.difficulty];
        if (currentBest === null || this.elapsedSeconds < currentBest.time) {
            this.bestTimes[this.difficulty] = {
                time: this.elapsedSeconds,
                date: new Date().toLocaleDateString(),
            };
            context.state.updateState({
                sudokuBestTimes: { ...this.bestTimes },
            });
            await context.state.persist();
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
                this.startGame(context);
                break;
            case 'q':
            case 'Q':
            case ESC:
                this.stopGame(context);
                break;
        }
    }

    // -- Cell conflict detection --------------------------------------------

    private hasConflict(row: number, col: number): boolean {
        const val = this.playerGrid[row][col];
        if (val === 0) return false;

        // Check row
        for (let c = 0; c < SIZE; c++) {
            if (c !== col && this.playerGrid[row][c] === val) return true;
        }
        // Check column
        for (let r = 0; r < SIZE; r++) {
            if (r !== row && this.playerGrid[r][col] === val) return true;
        }
        // Check box
        const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
        const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
        for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
            for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
                if (r !== row && c !== col && this.playerGrid[r][c] === val) return true;
            }
        }
        return false;
    }

    // -- Rendering ----------------------------------------------------------

    private render(context: ICliExecutionContext): void {
        const buf: string[] = [];

        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        // Inner width between outer double-vertical borders:
        // 9 cells * 3 chars + 6 thin separators + 2 double separators = 35
        const gridInnerWidth = SIZE * 3 + (SIZE - 1); // = 35

        // -- Title ----------------------------------------------------------
        const config = DIFFICULTIES[this.difficulty];
        const title = ` SUDOKU - ${config.label} `;
        const titlePad = Math.max(
            0,
            Math.floor((gridInnerWidth - title.length) / 2),
        );

        let currentRow = this.offsetY;

        // Top border (double line)
        buf.push(ansi.cursorTo(currentRow, this.offsetX));
        buf.push(
            ansi.fg.cyan,
            BOX.doubleTopLeft,
            BOX.doubleHorizontal.repeat(titlePad),
            ansi.bold,
            ansi.fg.yellow,
            title,
            ansi.reset,
            ansi.fg.cyan,
            BOX.doubleHorizontal.repeat(
                Math.max(0, gridInnerWidth - titlePad - title.length),
            ),
            BOX.doubleTopRight,
            ansi.reset,
        );
        currentRow++;

        // -- Grid rows ------------------------------------------------------
        for (let r = 0; r < SIZE; r++) {
            // Horizontal separator between rows
            if (r > 0) {
                buf.push(ansi.cursorTo(currentRow, this.offsetX));
                if (r % BOX_SIZE === 0) {
                    // Double-line separator at box boundaries
                    buf.push(ansi.fg.cyan);
                    buf.push(BOX.doubleTeeRight);
                    for (let c = 0; c < SIZE; c++) {
                        buf.push(BOX.doubleHorizontal.repeat(3));
                        if (c < SIZE - 1) {
                            buf.push(
                                (c + 1) % BOX_SIZE === 0
                                    ? BOX.doubleCross
                                    : BOX.doubleHorizontal,
                            );
                        }
                    }
                    buf.push(BOX.doubleTeeLeft);
                    buf.push(ansi.reset);
                } else {
                    // Thin separator within a box
                    buf.push(ansi.fg.cyan);
                    buf.push(BOX.doubleVertical);
                    for (let c = 0; c < SIZE; c++) {
                        buf.push(BOX.horizontal.repeat(3));
                        if (c < SIZE - 1) {
                            buf.push(
                                (c + 1) % BOX_SIZE === 0
                                    ? BOX.doubleVertical
                                    : BOX.horizontal,
                            );
                        }
                    }
                    buf.push(BOX.doubleVertical);
                    buf.push(ansi.reset);
                }
                currentRow++;
            }

            // Cell row
            buf.push(ansi.cursorTo(currentRow, this.offsetX));
            buf.push(ansi.fg.cyan, BOX.doubleVertical, ansi.reset);

            for (let c = 0; c < SIZE; c++) {
                const isCursor = r === this.cursorRow && c === this.cursorCol;
                const isGiven = this.given[r][c];
                const value = this.playerGrid[r][c];
                const hasNotes = this.notes[r][c].size > 0;
                const conflict = !isGiven && this.hasConflict(r, c);

                let cellStr: string;

                if (value !== 0) {
                    // Cell has a number
                    let color: string;
                    if (isGiven) {
                        color = ansi.fg.white + ansi.bold;
                    } else if (conflict) {
                        color = ansi.fg.red + ansi.bold;
                    } else {
                        color = ansi.fg.brightCyan;
                    }
                    cellStr = `${color} ${value} ${ansi.reset}`;
                } else if (hasNotes) {
                    // Show a small dot to indicate notes exist
                    cellStr = `${ansi.fg.gray}${ansi.dim} \u00B7 ${ansi.reset}`;
                } else {
                    // Empty cell
                    cellStr = '   ';
                }

                // Apply cursor highlight
                if (isCursor) {
                    buf.push(ansi.inverse, cellStr, ansi.reset);
                } else {
                    // Highlight cells with same value as cursor
                    const cursorVal = this.playerGrid[this.cursorRow][this.cursorCol];
                    if (cursorVal !== 0 && value === cursorVal) {
                        buf.push(ansi.bg.darkGray, cellStr, ansi.reset);
                    } else {
                        buf.push(cellStr);
                    }
                }

                // Column separator
                if (c < SIZE - 1) {
                    if ((c + 1) % BOX_SIZE === 0) {
                        buf.push(ansi.fg.cyan, BOX.doubleVertical, ansi.reset);
                    } else {
                        buf.push(ansi.fg.cyan, BOX.vertical, ansi.reset);
                    }
                }
            }

            buf.push(ansi.fg.cyan, BOX.doubleVertical, ansi.reset);
            currentRow++;
        }

        // -- Bottom border --------------------------------------------------
        buf.push(ansi.cursorTo(currentRow, this.offsetX));
        buf.push(
            ansi.fg.cyan,
            BOX.doubleBottomLeft,
            BOX.doubleHorizontal.repeat(gridInnerWidth),
            BOX.doubleBottomRight,
            ansi.reset,
        );
        currentRow++;

        // -- HUD ------------------------------------------------------------
        const hudRow = currentRow + 1;
        const timeStr = this.formatTime(this.elapsedSeconds);
        const bestTime = this.bestTimes[this.difficulty];
        const bestStr = bestTime !== null
            ? this.formatTime(bestTime.time)
            : '--:--';

        // Count remaining empty cells
        let emptyCells = 0;
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (this.playerGrid[r][c] === 0) emptyCells++;
            }
        }

        buf.push(ansi.cursorTo(hudRow, this.offsetX));
        buf.push(
            ansi.fg.white,
            '  ',
            '\u23F1 ',
            timeStr,
            ansi.fg.gray,
            '  |  ',
            'Best: ',
            ansi.fg.yellow,
            bestStr,
            ansi.fg.gray,
            '  |  ',
            ansi.fg.white,
            `${emptyCells}`,
            ansi.fg.gray,
            ' empty',
            '  |  ',
            ansi.fg.white,
            config.label,
            ansi.reset,
        );

        // Notes mode indicator + errors
        buf.push(ansi.cursorTo(hudRow + 1, this.offsetX));
        buf.push(
            '  ',
            this.notesMode
                ? `${ansi.fg.yellow}${ansi.bold}[N] NOTES ON${ansi.reset}`
                : `${ansi.dim}[N] Notes off${ansi.reset}`,
        );

        if (this.errors > 0) {
            buf.push(
                ansi.fg.gray,
                '  |  ',
                ansi.fg.red,
                `${this.errors} error${this.errors > 1 ? 's' : ''} found`,
                ansi.reset,
            );
        }

        // Controls
        buf.push(ansi.cursorTo(hudRow + 2, this.offsetX));
        buf.push(
            ansi.dim,
            '  [1-9] Place  [0/\u232B] Clear  [N] Notes  [H] Hint  [C] Check  [Esc] Quit',
            ansi.reset,
        );

        // -- Notes display for current cell ---------------------------------
        const curNotes = this.notes[this.cursorRow][this.cursorCol];
        if (curNotes.size > 0 && !this.given[this.cursorRow][this.cursorCol]) {
            buf.push(ansi.cursorTo(hudRow + 3, this.offsetX));
            const noteNums = [...curNotes].sort().join(' ');
            buf.push(
                ansi.fg.gray,
                `  Notes: `,
                ansi.fg.yellow,
                noteNums,
                ansi.reset,
            );
        }

        // -- Win overlay ----------------------------------------------------
        if (this.gameWon) {
            this.renderWinOverlay(buf, gridInnerWidth);
        }

        context.terminal.write(buf.join(''));
    }

    private renderWinOverlay(buf: string[], gridWidth: number): void {
        const gridContentHeight = SIZE + (SIZE - 1); // rows + separators
        const centerY =
            this.offsetY + 1 + Math.floor(gridContentHeight / 2);

        const currentBest = this.bestTimes[this.difficulty];
        const isNewRecord =
            currentBest !== null && currentBest.time === this.elapsedSeconds;

        const boxWidth = 28;
        const boxLeft =
            this.offsetX + Math.floor((gridWidth + 2 - boxWidth) / 2);

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
            ? '  NEW RECORD! SOLVED!'
            : '     PUZZLE SOLVED!     ';
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
            '  [R] New Game  [Q] Quit  ',
            ansi.reset,
            borderColor,
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

import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

// -- Types ------------------------------------------------------------------

type Grid = number[][];

interface GameState {
    grid: Grid;
    score: number;
}

interface HighScore {
    score: number;
    date: string;
}

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
        brightCyan: `${CSI}96m`,
        brightYellow: `${CSI}93;1m`,
        brightGreen: `${CSI}92m`,
        brightMagenta: `${CSI}95m`,
        brightRed: `${CSI}91;1m`,
        gray: `${CSI}90m`,
    },
    bg: {
        white: `${CSI}47m`,
        cyan: `${CSI}46m`,
        yellow: `${CSI}43m`,
        green: `${CSI}42m`,
        magenta: `${CSI}45m`,
        red: `${CSI}41m`,
        brightCyan: `${CSI}106m`,
        brightYellow: `${CSI}103m`,
        brightGreen: `${CSI}102m`,
        brightMagenta: `${CSI}105m`,
        brightRed: `${CSI}101m`,
        darkGray: `${CSI}100m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    reset: `${CSI}0m`,
};

// Box-drawing characters
const BOX = {
    topLeft: '\u250C', // +
    topRight: '\u2510', // +
    bottomLeft: '\u2514', // +
    bottomRight: '\u2518', // +
    horizontal: '\u2500', // -
    vertical: '\u2502', // |
};

// Grid constants
const GRID_SIZE = 4;
const CELL_WIDTH = 8; // Width of each cell (enough for "  2048  ")
const CELL_HEIGHT = 3; // Height of each cell (top padding, number, bottom padding)

// -- Tile color mapping -----------------------------------------------------

function tileColor(value: number): { fg: string; bg: string } {
    switch (value) {
        case 2:
            return { fg: `${CSI}30m`, bg: ansi.bg.white };
        case 4:
            return { fg: `${CSI}30m`, bg: ansi.bg.cyan };
        case 8:
            return { fg: `${CSI}30m`, bg: ansi.bg.yellow };
        case 16:
            return { fg: `${CSI}30m`, bg: ansi.bg.green };
        case 32:
            return { fg: `${CSI}97m`, bg: ansi.bg.magenta };
        case 64:
            return { fg: `${CSI}97m`, bg: ansi.bg.red };
        case 128:
            return { fg: `${CSI}30m`, bg: ansi.bg.brightCyan };
        case 256:
            return { fg: `${CSI}30m`, bg: ansi.bg.brightYellow };
        case 512:
            return { fg: `${CSI}30m`, bg: ansi.bg.brightGreen };
        case 1024:
            return { fg: `${CSI}97m`, bg: ansi.bg.brightMagenta };
        case 2048:
            return { fg: `${CSI}97m${CSI}1m`, bg: ansi.bg.brightRed };
        default:
            // Values beyond 2048
            return { fg: `${CSI}97m${CSI}1m`, bg: ansi.bg.brightRed };
    }
}

// -- Processor --------------------------------------------------------------

export class Cli2048CommandProcessor implements ICliCommandProcessor {
    command = '2048';

    description = 'Play the classic 2048 sliding-tile puzzle in your terminal';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        module: 'games',
        icon: '\uD83D\uDD22', // U+1F522
        requiredCoreVersion: '0.0.16',
        requiredCliVersion: '1.0.37',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            game2048HighScores: [],
        },
    };

    // -- Game state ---------------------------------------------------------

    private grid: Grid = [];
    private score = 0;
    private bestScore = 0;
    private gameOver = false;
    private won = false;
    private keepPlaying = false;
    private highScores: HighScore[] = [];
    private context: ICliExecutionContext | null = null;

    // Undo support (single level)
    private previousState: GameState | null = null;

    // Layout
    private offsetX = 0;
    private offsetY = 0;

    constructor() {
        this.registerSubProcessors();
    }

    // -- Lifecycle ----------------------------------------------------------

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<HighScore[]>((x) => x['game2048HighScores'])
            .subscribe((scores) => {
                this.highScores = scores ?? [];
                this.bestScore =
                    this.highScores.length > 0
                        ? Math.max(...this.highScores.map((s) => s.score))
                        : 0;
            });
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        this.context = context;
        this.startGame(context);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.gameOver) {
            this.handleGameOverInput(data, context);
            return;
        }

        // Win screen: only accept C (continue) or Q (quit)
        if (this._winScreenShowing) {
            switch (data) {
                case 'c':
                case 'C':
                    this._winScreenShowing = false;
                    this.keepPlaying = true;
                    this.render(context);
                    return;
                case 'q':
                case 'Q':
                case ESC:
                    this.stopGame(context);
                    return;
            }
            return;
        }

        let moved = false;

        switch (data) {
            // Arrow keys
            case `${ESC}[A`: // Up
            case 'w':
            case 'W':
                moved = this.move('up');
                break;
            case `${ESC}[B`: // Down
            case 's':
            case 'S':
                moved = this.move('down');
                break;
            case `${ESC}[C`: // Right
            case 'd':
            case 'D':
                moved = this.move('right');
                break;
            case `${ESC}[D`: // Left
            case 'a':
            case 'A':
                moved = this.move('left');
                break;

            // Undo
            case 'u':
            case 'U':
                this.undo();
                this.render(context);
                return;

            // Quit
            case ESC:
                this.stopGame(context);
                return;
        }

        if (moved) {
            this.spawnRandomTile();

            // Check win
            if (!this.won && this.hasWon()) {
                this.won = true;
            }

            // Check game over
            if (this.isGameOver()) {
                this.gameOver = true;
                this.saveHighScore();
            }

            this.render(context);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('2048', CliForegroundColor.Cyan)}                Start the game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('2048 scores', CliForegroundColor.Cyan)}         View high scores`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('2048 reset', CliForegroundColor.Cyan)}          Reset high scores`,
        );
        writer.writeln();
        writer.writeln('Controls:');
        writer.writeln(
            `  ${writer.wrapInColor('Arrow keys / WASD', CliForegroundColor.Yellow)}  Slide tiles`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('U', CliForegroundColor.Yellow)}                  Undo last move`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Esc', CliForegroundColor.Yellow)}                Quit game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('R', CliForegroundColor.Yellow)}                  Restart (after game over)`,
        );
    }

    // -- Sub-processors -----------------------------------------------------

    private registerSubProcessors(): void {
        this.processors = [
            {
                command: 'scores',
                description: 'View high scores',
                processCommand: async (_, context) => {
                    if (this.highScores.length === 0) {
                        context.writer.writeInfo(
                            'No high scores yet. Play a game first!',
                        );
                        return;
                    }

                    context.writer.writeln();
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            '  HIGH SCORES',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    context.writer.writeln();

                    const sorted = [...this.highScores]
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 10);

                    sorted.forEach((entry, i) => {
                        const rank = `${i + 1}`.padStart(2);
                        const score = `${entry.score}`.padStart(6);
                        const medal =
                            i === 0
                                ? ' \uD83E\uDD47'
                                : i === 1
                                  ? ' \uD83E\uDD48'
                                  : i === 2
                                    ? ' \uD83E\uDD49'
                                    : '   ';
                        context.writer.writeln(
                            `  ${rank}. ${context.writer.wrapInColor(score, CliForegroundColor.Cyan)}  ${entry.date}${medal}`,
                        );
                    });
                    context.writer.writeln();
                },
            },
            {
                command: 'reset',
                description: 'Reset all high scores',
                processCommand: async (_, context) => {
                    this.highScores = [];
                    this.bestScore = 0;
                    context.state.updateState({ game2048HighScores: [] });
                    await context.state.persist();
                    context.writer.writeSuccess(
                        'High scores have been reset.',
                    );
                },
            },
        ];
    }

    // -- Game lifecycle -----------------------------------------------------

    private startGame(context: ICliExecutionContext): void {
        this.computeLayout(context);
        this.resetGameState();
        context.enterFullScreenMode(this);
        this.render(context);
    }

    private stopGame(context: ICliExecutionContext): void {
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
        // Nothing to clean up -- no timers in a turn-based game
    }

    private resetGameState(): void {
        this.grid = this.createEmptyGrid();
        this.score = 0;
        this.gameOver = false;
        this.won = false;
        this.keepPlaying = false;
        this._winScreenShowing = false;
        this.previousState = null;

        this.spawnRandomTile();
        this.spawnRandomTile();
    }

    private computeLayout(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;

        // Total grid visual width: 1 (left border) + GRID_SIZE * (CELL_WIDTH + 1)
        const totalWidth = 1 + GRID_SIZE * (CELL_WIDTH + 1);
        // Total grid visual height:
        //   1 (top border) + GRID_SIZE * CELL_HEIGHT (cell rows) + (GRID_SIZE - 1) (separators) + 1 (bottom border)
        //   = GRID_SIZE * CELL_HEIGHT + GRID_SIZE - 1 + 2
        //   = 4 * 3 + 3 + 2 = 17
        const totalHeight =
            GRID_SIZE * CELL_HEIGHT + (GRID_SIZE - 1) + 2;

        // Center horizontally
        this.offsetX = Math.max(
            1,
            Math.floor((cols - totalWidth) / 2) + 1,
        );

        // Center vertically, leaving room for title (2 rows) and HUD (3 rows)
        this.offsetY = Math.max(
            1,
            Math.floor((rows - totalHeight - 5) / 2) + 1,
        );
    }

    // -- Grid helpers -------------------------------------------------------

    private createEmptyGrid(): Grid {
        const grid: Grid = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            grid.push(new Array(GRID_SIZE).fill(0));
        }
        return grid;
    }

    private cloneGrid(grid: Grid): Grid {
        return grid.map((row) => [...row]);
    }

    private spawnRandomTile(): void {
        const empty: { r: number; c: number }[] = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (this.grid[r][c] === 0) {
                    empty.push({ r, c });
                }
            }
        }
        if (empty.length === 0) return;

        const cell = empty[Math.floor(Math.random() * empty.length)];
        this.grid[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
    }

    private tileCount(): number {
        let count = 0;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (this.grid[r][c] !== 0) count++;
            }
        }
        return count;
    }

    // -- Move logic ---------------------------------------------------------

    private move(direction: 'up' | 'down' | 'left' | 'right'): boolean {
        // Save state for undo before attempting move
        const savedGrid = this.cloneGrid(this.grid);
        const savedScore = this.score;

        let moved = false;

        switch (direction) {
            case 'left':
                moved = this.slideLeft();
                break;
            case 'right':
                moved = this.slideRight();
                break;
            case 'up':
                moved = this.slideUp();
                break;
            case 'down':
                moved = this.slideDown();
                break;
        }

        if (moved) {
            this.previousState = {
                grid: savedGrid,
                score: savedScore,
            };
        }

        return moved;
    }

    private slideLeft(): boolean {
        let moved = false;
        for (let r = 0; r < GRID_SIZE; r++) {
            const result = this.slideRow(this.grid[r]);
            if (result.changed) moved = true;
            this.grid[r] = result.row;
        }
        return moved;
    }

    private slideRight(): boolean {
        let moved = false;
        for (let r = 0; r < GRID_SIZE; r++) {
            const reversed = [...this.grid[r]].reverse();
            const result = this.slideRow(reversed);
            if (result.changed) moved = true;
            this.grid[r] = result.row.reverse();
        }
        return moved;
    }

    private slideUp(): boolean {
        let moved = false;
        for (let c = 0; c < GRID_SIZE; c++) {
            const col = this.getColumn(c);
            const result = this.slideRow(col);
            if (result.changed) moved = true;
            this.setColumn(c, result.row);
        }
        return moved;
    }

    private slideDown(): boolean {
        let moved = false;
        for (let c = 0; c < GRID_SIZE; c++) {
            const col = this.getColumn(c).reverse();
            const result = this.slideRow(col);
            if (result.changed) moved = true;
            this.setColumn(c, result.row.reverse());
        }
        return moved;
    }

    private slideRow(row: number[]): { row: number[]; changed: boolean } {
        // Remove zeros
        const filtered = row.filter((v) => v !== 0);

        // Merge adjacent equal tiles
        const merged: number[] = [];
        let i = 0;
        while (i < filtered.length) {
            if (
                i + 1 < filtered.length &&
                filtered[i] === filtered[i + 1]
            ) {
                const mergedValue = filtered[i] * 2;
                merged.push(mergedValue);
                this.score += mergedValue;
                i += 2;
            } else {
                merged.push(filtered[i]);
                i++;
            }
        }

        // Pad with zeros
        while (merged.length < GRID_SIZE) {
            merged.push(0);
        }

        // Check if anything changed
        const changed = row.some((v, idx) => v !== merged[idx]);

        return { row: merged, changed };
    }

    private getColumn(c: number): number[] {
        return this.grid.map((row) => row[c]);
    }

    private setColumn(c: number, col: number[]): void {
        for (let r = 0; r < GRID_SIZE; r++) {
            this.grid[r][c] = col[r];
        }
    }

    // -- Win / game over detection ------------------------------------------

    private hasWon(): boolean {
        if (this.keepPlaying) return false;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (this.grid[r][c] >= 2048) return true;
            }
        }
        return false;
    }

    private isGameOver(): boolean {
        // If there are empty cells, game is not over
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (this.grid[r][c] === 0) return false;
            }
        }

        // Check for possible merges
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const val = this.grid[r][c];
                // Check right neighbor
                if (c + 1 < GRID_SIZE && this.grid[r][c + 1] === val)
                    return false;
                // Check bottom neighbor
                if (r + 1 < GRID_SIZE && this.grid[r + 1][c] === val)
                    return false;
            }
        }

        return true;
    }

    // -- Undo ---------------------------------------------------------------

    private undo(): void {
        if (!this.previousState) return;
        this.grid = this.previousState.grid;
        this.score = this.previousState.score;
        this.previousState = null;
        this.gameOver = false;
    }

    // -- High score persistence ---------------------------------------------

    private async saveHighScore(): Promise<void> {
        if (this.score <= 0) return;

        this.highScores.push({
            score: this.score,
            date: new Date().toLocaleDateString(),
        });

        // Keep top 20
        this.highScores.sort((a, b) => b.score - a.score);
        this.highScores = this.highScores.slice(0, 20);
        this.bestScore = this.highScores[0].score;

        if (this.context) {
            this.context.state.updateState({
                game2048HighScores: this.highScores,
            });
            await this.context.state.persist();
        }
    }

    // -- Input handling after game over -------------------------------------

    private handleGameOverInput(
        data: string,
        context: ICliExecutionContext,
    ): void {
        switch (data) {
            case 'r':
            case 'R':
                this.computeLayout(context);
                this.resetGameState();
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

        // -- Title ----------------------------------------------------------
        const title = ' 2048 ';
        const gridVisualWidth = 1 + GRID_SIZE * (CELL_WIDTH + 1);
        const titlePad = Math.max(
            0,
            Math.floor((gridVisualWidth - title.length) / 2),
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
                Math.max(0, gridVisualWidth - 2 - titlePad - title.length),
            ),
            BOX.topRight,
            ansi.reset,
        );

        // -- Grid -----------------------------------------------------------
        // Each row of tiles is rendered as CELL_HEIGHT (3) screen rows:
        //   | <pad>  | <pad>  | <pad>  | <pad>  |   (row 1: top padding)
        //   | <num>  | <num>  | <num>  | <num>  |   (row 2: centered number)
        //   | <pad>  | <pad>  | <pad>  | <pad>  |   (row 3: bottom padding)
        // With single-line horizontal separators between tile rows.

        let currentRow = this.offsetY + 1;

        for (let r = 0; r < GRID_SIZE; r++) {
            // Build multi-line cell content for this row
            const cellLines: string[][] = [];
            for (let c = 0; c < GRID_SIZE; c++) {
                cellLines.push(this.renderCell(this.grid[r][c]));
            }

            // Render CELL_HEIGHT screen rows for this tile row
            for (let line = 0; line < CELL_HEIGHT; line++) {
                buf.push(ansi.cursorTo(currentRow, this.offsetX));
                buf.push(ansi.fg.cyan, BOX.vertical, ansi.reset);

                for (let c = 0; c < GRID_SIZE; c++) {
                    buf.push(cellLines[c][line]);
                    buf.push(ansi.fg.cyan, BOX.vertical, ansi.reset);
                }

                currentRow++;
            }

            // Horizontal separator (except after last row)
            if (r < GRID_SIZE - 1) {
                buf.push(ansi.cursorTo(currentRow, this.offsetX));
                buf.push(ansi.fg.cyan);
                buf.push(BOX.vertical);
                for (let c = 0; c < GRID_SIZE; c++) {
                    buf.push(BOX.horizontal.repeat(CELL_WIDTH));
                    if (c < GRID_SIZE - 1) {
                        buf.push(BOX.horizontal);
                    }
                }
                buf.push(BOX.vertical);
                buf.push(ansi.reset);
                currentRow++;
            }
        }

        // -- Bottom border --------------------------------------------------
        buf.push(ansi.cursorTo(currentRow, this.offsetX));
        buf.push(
            ansi.fg.cyan,
            BOX.bottomLeft,
            BOX.horizontal.repeat(gridVisualWidth - 2),
            BOX.bottomRight,
            ansi.reset,
        );
        currentRow++;

        // -- HUD ------------------------------------------------------------
        const hudRow = currentRow + 1;

        buf.push(ansi.cursorTo(hudRow, this.offsetX));
        buf.push(
            ansi.fg.white,
            '  Score: ',
            ansi.bold,
            ansi.fg.yellow,
            `${this.score}`,
            ansi.reset,
            ansi.fg.gray,
            `  |  Best: ${this.bestScore}`,
            `  |  Tiles: ${this.tileCount()}`,
            ansi.reset,
        );

        // Controls hint
        buf.push(ansi.cursorTo(hudRow + 1, this.offsetX));
        buf.push(
            ansi.dim,
            '  [WASD/Arrows] Slide  [U] Undo  [Esc] Quit',
            ansi.reset,
        );

        // -- Win overlay ----------------------------------------------------
        if (this.won && !this.keepPlaying) {
            this.renderWinOverlay(buf);
        }

        // -- Game over overlay ----------------------------------------------
        if (this.gameOver) {
            this.renderGameOverOverlay(buf);
        }

        context.terminal.write(buf.join(''));
    }

    /**
     * Returns an array of CELL_HEIGHT (3) strings, one per screen row:
     *   [0] top padding row (spaces with background color)
     *   [1] center row with the number
     *   [2] bottom padding row (spaces with background color)
     */
    private renderCell(value: number): string[] {
        const emptyRow = ' '.repeat(CELL_WIDTH);

        if (value === 0) {
            const content = '\u00B7'.padStart(
                Math.floor(CELL_WIDTH / 2) + 1,
            );
            const centerLine =
                ansi.fg.gray +
                content.padEnd(CELL_WIDTH) +
                ansi.reset;
            const padLine = ansi.reset + emptyRow;
            return [padLine, centerLine, padLine];
        }

        const label = `${value}`;
        const padTotal = CELL_WIDTH - label.length;
        const padLeft = Math.floor(padTotal / 2);
        const padRight = padTotal - padLeft;

        const colors = tileColor(value);

        const padLine =
            colors.bg + emptyRow + ansi.reset;
        const centerLine =
            colors.bg +
            colors.fg +
            ' '.repeat(padLeft) +
            label +
            ' '.repeat(padRight) +
            ansi.reset;

        return [padLine, centerLine, padLine];
    }

    private renderGameOverOverlay(buf: string[]): void {
        const gridVisualWidth = 1 + GRID_SIZE * (CELL_WIDTH + 1);
        // Grid content height: GRID_SIZE * CELL_HEIGHT + (GRID_SIZE - 1) separators
        const gridVisualHeight =
            GRID_SIZE * CELL_HEIGHT + (GRID_SIZE - 1);
        const centerY =
            this.offsetY + 1 + Math.floor(gridVisualHeight / 2);

        const boxWidth = 24;
        const boxLeft =
            this.offsetX +
            Math.floor((gridVisualWidth - boxWidth) / 2);

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
        const scoreText = `    Score: ${this.score}`;
        buf.push(
            ansi.reset,
            ansi.fg.yellow,
            scoreText.padEnd(boxWidth - 2),
            ansi.fg.red,
        );
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY + 1, boxLeft));
        buf.push(BOX.vertical);
        buf.push(
            ansi.reset,
            ansi.dim,
            '  [R] Retry  [Q] Quit',
            ansi.reset,
            ansi.fg.red,
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
        const gridVisualWidth = 1 + GRID_SIZE * (CELL_WIDTH + 1);
        // Grid content height: GRID_SIZE * CELL_HEIGHT + (GRID_SIZE - 1) separators
        const gridVisualHeight =
            GRID_SIZE * CELL_HEIGHT + (GRID_SIZE - 1);
        const centerY =
            this.offsetY + 1 + Math.floor(gridVisualHeight / 2);

        const boxWidth = 28;
        const boxLeft =
            this.offsetX +
            Math.floor((gridVisualWidth - boxWidth) / 2);

        buf.push(ansi.cursorTo(centerY - 2, boxLeft));
        buf.push(
            ansi.fg.yellow,
            BOX.topLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.topRight,
        );

        buf.push(ansi.cursorTo(centerY - 1, boxLeft));
        buf.push(BOX.vertical);
        const winText = '   YOU REACHED 2048!    ';
        buf.push(
            ansi.bold,
            winText.padEnd(boxWidth - 2),
            ansi.reset,
            ansi.fg.yellow,
        );
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY, boxLeft));
        buf.push(BOX.vertical);
        const scoreText = `    Score: ${this.score}`;
        buf.push(
            ansi.reset,
            ansi.fg.brightGreen,
            scoreText.padEnd(boxWidth - 2),
            ansi.fg.yellow,
        );
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY + 1, boxLeft));
        buf.push(BOX.vertical);
        buf.push(
            ansi.reset,
            ansi.dim,
            ' [C] Continue  [Q] Quit  ',
            ansi.reset,
            ansi.fg.yellow,
        );
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY + 2, boxLeft));
        buf.push(
            BOX.bottomLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.bottomRight,
            ansi.reset,
        );

        this._winScreenShowing = true;
    }

    // When true, onData only accepts C (continue) or Q (quit)
    private _winScreenShowing = false;
}

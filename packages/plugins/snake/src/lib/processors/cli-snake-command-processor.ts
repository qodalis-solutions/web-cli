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

// ── Types ────────────────────────────────────────────────────────────

interface Point {
    x: number;
    y: number;
}

enum Direction {
    Up,
    Down,
    Left,
    Right,
}

interface HighScore {
    score: number;
    date: string;
}

// ── ANSI helpers ─────────────────────────────────────────────────────

const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
    clearScreen: `${CSI}2J`,
    cursorHome: `${CSI}H`,
    hideCursor: `${CSI}?25l`,
    showCursor: `${CSI}?25h`,
    cursorTo: (row: number, col: number) => `${CSI}${row};${col}H`,
    fg: {
        green: `${CSI}32m`,
        brightGreen: `${CSI}92m`,
        red: `${CSI}91m`,
        yellow: `${CSI}93m`,
        cyan: `${CSI}36m`,
        white: `${CSI}97m`,
        gray: `${CSI}90m`,
        magenta: `${CSI}35m`,
        reset: `${CSI}0m`,
    },
    bg: {
        green: `${CSI}42m`,
        red: `${CSI}41m`,
        yellow: `${CSI}43m`,
        blue: `${CSI}44m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    reset: `${CSI}0m`,
};

// ── Constants ────────────────────────────────────────────────────────

const INITIAL_SPEED_MS = 150;
const MIN_SPEED_MS = 60;
const SPEED_DECREASE_PER_FOOD = 3;

// Box-drawing characters
const BOX = {
    topLeft: '\u250C',     // ┌
    topRight: '\u2510',    // ┐
    bottomLeft: '\u2514',  // └
    bottomRight: '\u2518', // ┘
    horizontal: '\u2500',  // ─
    vertical: '\u2502',    // │
};

const SNAKE_HEAD = '\u2588';   // █
const SNAKE_BODY = '\u2593';   // ▓
const FOOD_CHAR = '\u25CF';    // ●
const EMPTY_CHAR = ' ';

// ── Processor ────────────────────────────────────────────────────────

export class CliSnakeCommandProcessor implements ICliCommandProcessor {
    command = 'snake';

    description = 'Play the classic Snake game in your terminal';

    aliases = ['snek'];

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        module: 'games',
        icon: '\uD83D\uDC0D',
        requiredCoreVersion: '0.0.16',
        requiredCliVersion: '1.0.37',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            snakeHighScores: [],
        },
    };

    // ── Game state ───────────────────────────────────────────────────

    private snake: Point[] = [];
    private food: Point = { x: 0, y: 0 };
    private direction: Direction = Direction.Right;
    private nextDirection: Direction = Direction.Right;
    private score = 0;
    private gameOver = false;
    private paused = false;
    private gameLoopTimer: ICliManagedInterval | null = null;
    private currentSpeed = INITIAL_SPEED_MS;
    private highScores: HighScore[] = [];
    private context: ICliExecutionContext | null = null;

    // Grid dimensions (computed from terminal size)
    private gridWidth = 0;
    private gridHeight = 0;

    // Offset for centering the grid in the terminal
    private offsetX = 0;
    private offsetY = 0;

    constructor() {
        this.registerSubProcessors();
    }

    // ── Lifecycle ────────────────────────────────────────────────────

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<HighScore[]>((x) => x['snakeHighScores'])
            .subscribe((scores) => {
                this.highScores = scores ?? [];
            });
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        // Default action: start the game
        this.context = context;
        this.startGame(context);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.gameOver) {
            this.handleGameOverInput(data, context);
            return;
        }

        // Parse input
        switch (data) {
            // Arrow keys
            case `${ESC}[A`: // Up
            case 'w':
            case 'W':
                if (this.direction !== Direction.Down) {
                    this.nextDirection = Direction.Up;
                }
                break;
            case `${ESC}[B`: // Down
            case 's':
            case 'S':
                if (this.direction !== Direction.Up) {
                    this.nextDirection = Direction.Down;
                }
                break;
            case `${ESC}[C`: // Right
            case 'd':
            case 'D':
                if (this.direction !== Direction.Left) {
                    this.nextDirection = Direction.Right;
                }
                break;
            case `${ESC}[D`: // Left
            case 'a':
            case 'A':
                if (this.direction !== Direction.Right) {
                    this.nextDirection = Direction.Left;
                }
                break;

            // Pause
            case ' ':
                this.paused = !this.paused;
                this.renderPauseOverlay(context);
                break;

            // Quit (Esc only — Q could be a future keybind)
            case ESC:
                this.stopGame(context);
                return;
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('snake', CliForegroundColor.Cyan)}                Start the game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('snake scores', CliForegroundColor.Cyan)}         View high scores`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('snake reset', CliForegroundColor.Cyan)}          Reset high scores`,
        );
        writer.writeln();
        writer.writeln('Controls:');
        writer.writeln(
            `  ${writer.wrapInColor('Arrow keys / WASD', CliForegroundColor.Yellow)}  Move the snake`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Space', CliForegroundColor.Yellow)}              Pause / Resume`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Esc', CliForegroundColor.Yellow)}                Quit game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('R', CliForegroundColor.Yellow)}                  Restart (after game over)`,
        );
    }

    // ── Sub-processors ───────────────────────────────────────────────

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
                            i === 0 ? ' \uD83E\uDD47' : i === 1 ? ' \uD83E\uDD48' : i === 2 ? ' \uD83E\uDD49' : '   ';
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
                    context.state.updateState({ snakeHighScores: [] });
                    await context.state.persist();
                    context.writer.writeSuccess('High scores have been reset.');
                },
            },
        ];
    }

    // ── Game lifecycle ───────────────────────────────────────────────

    private startGame(context: ICliExecutionContext): void {
        this.computeGrid(context);
        this.resetGameState();

        context.enterFullScreenMode(this);
        this.scheduleGameLoop(context);
        this.render(context);
    }

    private stopGame(context: ICliExecutionContext): void {
        // exitFullScreenMode auto-clears managed timers and calls onDispose
        context.exitFullScreenMode();
        this.context = null;
    }

    onResize(
        cols: number,
        rows: number,
        context: ICliExecutionContext,
    ): void {
        this.computeGrid(context);

        // Clamp snake and food positions to new grid bounds
        for (const segment of this.snake) {
            segment.x = Math.min(segment.x, this.gridWidth - 1);
            segment.y = Math.min(segment.y, this.gridHeight - 1);
        }
        if (this.food.x >= this.gridWidth || this.food.y >= this.gridHeight) {
            this.spawnFood();
        }

        this.render(context);
    }

    onDispose(context: ICliExecutionContext): void {
        // Engine already clears managed timers, but reset our reference
        this.gameLoopTimer = null;
    }

    private resetGameState(): void {
        const centerX = Math.floor(this.gridWidth / 2);
        const centerY = Math.floor(this.gridHeight / 2);

        this.snake = [
            { x: centerX, y: centerY },
            { x: centerX - 1, y: centerY },
            { x: centerX - 2, y: centerY },
        ];
        this.direction = Direction.Right;
        this.nextDirection = Direction.Right;
        this.score = 0;
        this.gameOver = false;
        this.paused = false;
        this.currentSpeed = INITIAL_SPEED_MS;
        this.spawnFood();
    }

    private computeGrid(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;

        // Reserve 2 for borders, 3 rows for HUD at bottom
        this.gridWidth = Math.min(cols - 2, 60);
        this.gridHeight = Math.min(rows - 5, 25);

        // Ensure minimum playable size
        this.gridWidth = Math.max(this.gridWidth, 15);
        this.gridHeight = Math.max(this.gridHeight, 10);

        // Center horizontally
        this.offsetX = Math.max(1, Math.floor((cols - this.gridWidth - 2) / 2));
        this.offsetY = 1;
    }

    // ── Game loop ────────────────────────────────────────────────────

    private scheduleGameLoop(context?: ICliExecutionContext): void {
        if (this.gameLoopTimer) {
            // Reuse existing timer with updated delay
            this.gameLoopTimer.setDelay(this.currentSpeed);
            return;
        }

        const ctx = context ?? this.context;
        if (!ctx) return;

        this.gameLoopTimer = ctx.createInterval(() => {
            this.tick();
        }, this.currentSpeed);
    }

    private tick(): void {
        if (this.paused || this.gameOver || !this.context) return;

        this.direction = this.nextDirection;

        // Compute new head
        const head = this.snake[0];
        let newHead: Point;

        switch (this.direction) {
            case Direction.Up:
                newHead = { x: head.x, y: head.y - 1 };
                break;
            case Direction.Down:
                newHead = { x: head.x, y: head.y + 1 };
                break;
            case Direction.Left:
                newHead = { x: head.x - 1, y: head.y };
                break;
            case Direction.Right:
                newHead = { x: head.x + 1, y: head.y };
                break;
        }

        // Check wall collision
        if (
            newHead.x < 0 ||
            newHead.x >= this.gridWidth ||
            newHead.y < 0 ||
            newHead.y >= this.gridHeight
        ) {
            this.handleGameOver();
            return;
        }

        // Check self-collision
        if (this.snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
            this.handleGameOver();
            return;
        }

        // Move snake
        this.snake.unshift(newHead);

        // Check food
        if (newHead.x === this.food.x && newHead.y === this.food.y) {
            this.score += 10;
            this.spawnFood();

            // Speed up
            this.currentSpeed = Math.max(
                MIN_SPEED_MS,
                INITIAL_SPEED_MS - Math.floor(this.score / 10) * SPEED_DECREASE_PER_FOOD,
            );
            this.gameLoopTimer?.setDelay(this.currentSpeed);
        } else {
            this.snake.pop();
        }

        this.render(this.context);
    }

    private spawnFood(): void {
        const occupied = new Set(
            this.snake.map((s) => `${s.x},${s.y}`),
        );

        let attempts = 0;
        do {
            this.food = {
                x: Math.floor(Math.random() * this.gridWidth),
                y: Math.floor(Math.random() * this.gridHeight),
            };
            attempts++;
        } while (
            occupied.has(`${this.food.x},${this.food.y}`) &&
            attempts < 1000
        );
    }

    private async handleGameOver(): Promise<void> {
        this.gameOver = true;
        this.gameLoopTimer?.clear();
        this.gameLoopTimer = null;

        // Save high score
        if (this.score > 0) {
            this.highScores.push({
                score: this.score,
                date: new Date().toLocaleDateString(),
            });

            // Keep top 20
            this.highScores.sort((a, b) => b.score - a.score);
            this.highScores = this.highScores.slice(0, 20);

            if (this.context) {
                this.context.state.updateState({
                    snakeHighScores: this.highScores,
                });
                await this.context.state.persist();
            }
        }

        if (this.context) {
            this.render(this.context);
        }
    }

    private handleGameOverInput(
        data: string,
        context: ICliExecutionContext,
    ): void {
        switch (data) {
            case 'r':
            case 'R':
                this.computeGrid(context);
                this.resetGameState();
                this.scheduleGameLoop(context);
                this.render(context);
                break;
            case 'q':
            case 'Q':
            case ESC:
                this.stopGame(context);
                break;
        }
    }

    // ── Rendering ────────────────────────────────────────────────────

    private render(context: ICliExecutionContext): void {
        const buf: string[] = [];

        // Clear screen and home cursor
        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        // ── Title bar ────────────────────────────────────────────────
        const title = ' SNAKE ';
        const titlePad = Math.max(
            0,
            Math.floor((this.gridWidth + 2 - title.length) / 2),
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
                Math.max(0, this.gridWidth - titlePad - title.length),
            ),
            BOX.topRight,
            ansi.reset,
        );

        // ── Grid rows ───────────────────────────────────────────────
        // Build a 2D lookup for snake body
        const snakeSet = new Map<string, number>();
        this.snake.forEach((s, i) => {
            snakeSet.set(`${s.x},${s.y}`, i);
        });

        for (let y = 0; y < this.gridHeight; y++) {
            const row = this.offsetY + 1 + y;
            buf.push(ansi.cursorTo(row, this.offsetX));
            buf.push(ansi.fg.cyan, BOX.vertical, ansi.reset);

            for (let x = 0; x < this.gridWidth; x++) {
                const key = `${x},${y}`;
                const snakeIdx = snakeSet.get(key);

                if (snakeIdx !== undefined) {
                    if (snakeIdx === 0) {
                        // Head
                        buf.push(
                            ansi.fg.brightGreen,
                            SNAKE_HEAD,
                            ansi.reset,
                        );
                    } else {
                        // Body
                        buf.push(ansi.fg.green, SNAKE_BODY, ansi.reset);
                    }
                } else if (x === this.food.x && y === this.food.y) {
                    buf.push(ansi.fg.red, FOOD_CHAR, ansi.reset);
                } else {
                    buf.push(EMPTY_CHAR);
                }
            }

            buf.push(ansi.fg.cyan, BOX.vertical, ansi.reset);
        }

        // ── Bottom border ────────────────────────────────────────────
        const bottomRow = this.offsetY + 1 + this.gridHeight;
        buf.push(ansi.cursorTo(bottomRow, this.offsetX));
        buf.push(
            ansi.fg.cyan,
            BOX.bottomLeft,
            BOX.horizontal.repeat(this.gridWidth),
            BOX.bottomRight,
            ansi.reset,
        );

        // ── HUD ──────────────────────────────────────────────────────
        const hudRow = bottomRow + 1;
        const bestScore =
            this.highScores.length > 0 ? this.highScores[0].score : 0;

        buf.push(ansi.cursorTo(hudRow, this.offsetX));
        buf.push(
            ansi.fg.white,
            '  Score: ',
            ansi.bold,
            ansi.fg.yellow,
            `${this.score}`,
            ansi.reset,
            ansi.fg.gray,
            `  |  Best: ${bestScore}`,
            `  |  Length: ${this.snake.length}`,
            `  |  Speed: ${Math.round((1000 / this.currentSpeed) * 10) / 10}/s`,
            ansi.reset,
        );

        // ── Controls hint ────────────────────────────────────────────
        buf.push(ansi.cursorTo(hudRow + 1, this.offsetX));
        buf.push(
            ansi.dim,
            '  [WASD/Arrows] Move  [Space] Pause  [Esc] Quit',
            ansi.reset,
        );

        // ── Game over overlay ────────────────────────────────────────
        if (this.gameOver) {
            this.renderGameOverOverlay(buf);
        }

        // ── Pause overlay ────────────────────────────────────────────
        if (this.paused && !this.gameOver) {
            this.renderPauseOverlayInBuf(buf);
        }

        context.terminal.write(buf.join(''));
    }

    private renderGameOverOverlay(buf: string[]): void {
        const centerY = this.offsetY + Math.floor(this.gridHeight / 2);
        const centerX = this.offsetX + Math.floor(this.gridWidth / 2) - 8;

        // Game over box
        const boxWidth = 22;
        const boxLeft = this.offsetX + Math.floor((this.gridWidth + 2 - boxWidth) / 2);

        buf.push(ansi.cursorTo(centerY - 2, boxLeft));
        buf.push(
            ansi.fg.red,
            BOX.topLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.topRight,
        );

        buf.push(ansi.cursorTo(centerY - 1, boxLeft));
        buf.push(BOX.vertical);
        const gameOverText = '   GAME OVER!    ';
        buf.push(ansi.bold, gameOverText.padEnd(boxWidth - 2), ansi.reset, ansi.fg.red);
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY, boxLeft));
        buf.push(BOX.vertical);
        const scoreText = `   Score: ${this.score}`;
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
            ' [R] Retry [Q] Quit',
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

    private renderPauseOverlay(context: ICliExecutionContext): void {
        // Quick render of just the pause text over the existing frame
        const buf: string[] = [];
        this.renderPauseOverlayInBuf(buf);
        context.terminal.write(buf.join(''));
    }

    private renderPauseOverlayInBuf(buf: string[]): void {
        const centerY = this.offsetY + Math.floor(this.gridHeight / 2);
        const boxWidth = 18;
        const boxLeft = this.offsetX + Math.floor((this.gridWidth + 2 - boxWidth) / 2);

        buf.push(ansi.cursorTo(centerY - 1, boxLeft));
        buf.push(
            ansi.fg.yellow,
            BOX.topLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.topRight,
        );

        buf.push(ansi.cursorTo(centerY, boxLeft));
        buf.push(BOX.vertical);
        buf.push(ansi.bold, '    PAUSED    '.padEnd(boxWidth - 2), ansi.reset, ansi.fg.yellow);
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY + 1, boxLeft));
        buf.push(
            BOX.bottomLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.bottomRight,
            ansi.reset,
        );
    }
}

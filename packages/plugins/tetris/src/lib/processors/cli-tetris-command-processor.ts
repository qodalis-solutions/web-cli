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

interface HighScore {
    score: number;
    level: number;
    lines: number;
    date: string;
}

/** A tetromino definition: rotations are arrays of (x,y) offsets */
interface TetrominoDef {
    /** Array of rotations; each rotation is an array of 4 points */
    rotations: Point[][];
    color: string;
    char: string;
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
        red: `${CSI}91m`,
        green: `${CSI}92m`,
        yellow: `${CSI}93m`,
        blue: `${CSI}94m`,
        magenta: `${CSI}95m`,
        cyan: `${CSI}96m`,
        white: `${CSI}97m`,
        gray: `${CSI}90m`,
        orange: `${CSI}38;5;208m`,
        brightCyan: `${CSI}96m`,
        reset: `${CSI}0m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    reset: `${CSI}0m`,
};

// ── Box-drawing characters ──────────────────────────────────────────

const BOX = {
    topLeft: '\u250C',     // +
    topRight: '\u2510',    // +
    bottomLeft: '\u2514',  // +
    bottomRight: '\u2518', // +
    horizontal: '\u2500',  // -
    vertical: '\u2502',    // |
};

const BLOCK_CHAR = '\u2588\u2588\u2588'; // Three full blocks (each cell = 3 chars wide for larger look)
const EMPTY_CELL = '   ';              // Three spaces
const GHOST_CHAR = '\u2591\u2591\u2591'; // Light shade for ghost piece

// ── Tetromino definitions ───────────────────────────────────────────
// Each piece defined with all 4 rotation states.
// Coordinates are relative offsets from an origin.

const TETROMINOES: Record<string, TetrominoDef> = {
    I: {
        rotations: [
            [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
            [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }],
            [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],
            [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }],
        ],
        color: ansi.fg.cyan,
        char: BLOCK_CHAR,
    },
    O: {
        rotations: [
            [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
            [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
            [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
            [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
        ],
        color: ansi.fg.yellow,
        char: BLOCK_CHAR,
    },
    T: {
        rotations: [
            [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
            [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 }],
            [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 }],
            [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
        ],
        color: ansi.fg.magenta,
        char: BLOCK_CHAR,
    },
    S: {
        rotations: [
            [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
            [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
            [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
            [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
        ],
        color: ansi.fg.green,
        char: BLOCK_CHAR,
    },
    Z: {
        rotations: [
            [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
            [{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
            [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
            [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }],
        ],
        color: ansi.fg.red,
        char: BLOCK_CHAR,
    },
    J: {
        rotations: [
            [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
            [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
            [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
            [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
        ],
        color: ansi.fg.blue,
        char: BLOCK_CHAR,
    },
    L: {
        rotations: [
            [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
            [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
            [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }],
            [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
        ],
        color: ansi.fg.orange,
        char: BLOCK_CHAR,
    },
};

const PIECE_NAMES = Object.keys(TETROMINOES);

// ── Wall kick data (SRS simplified) ─────────────────────────────────
// Basic wall kicks: try (0,0), then offsets
const WALL_KICKS: Point[] = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
];

// ── Constants ────────────────────────────────────────────────────────

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const INITIAL_SPEED_MS = 800;
const MIN_SPEED_MS = 100;
const SPEED_DECREASE_PER_LEVEL = 70;

// Scoring
const LINE_SCORES: Record<number, number> = {
    1: 100,
    2: 300,
    3: 500,
    4: 800,
};

// ── Active piece state ──────────────────────────────────────────────

interface ActivePiece {
    type: string;
    rotation: number;
    x: number; // board-space x of the piece origin
    y: number; // board-space y of the piece origin
}

// ── Processor ────────────────────────────────────────────────────────

export class CliTetrisCommandProcessor implements ICliCommandProcessor {
    command = 'tetris';

    description = 'Play the classic Tetris game in your terminal';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        module: 'games',
        icon: '\uD83E\uDDF1', // brick emoji
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            tetrisHighScores: [],
        },
    };

    // ── Game state ───────────────────────────────────────────────────

    private board: (string | null)[][] = []; // board[y][x] = color or null
    private currentPiece: ActivePiece | null = null;
    private nextPieceType = '';
    private score = 0;
    private level = 1;
    private linesCleared = 0;
    private gameOver = false;
    private paused = false;
    private gameLoopTimer: ICliManagedInterval | null = null;
    private currentSpeed = INITIAL_SPEED_MS;
    private highScores: HighScore[] = [];
    private context: ICliExecutionContext | null = null;

    // Display offsets (for centering in terminal)
    private offsetX = 0;
    private offsetY = 0;

    constructor() {
        this.registerSubProcessors();
    }

    // ── Lifecycle ────────────────────────────────────────────────────

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<HighScore[]>((x) => x['tetrisHighScores'])
            .subscribe((scores) => {
                this.highScores = scores ?? [];
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

        switch (data) {
            // Rotate clockwise
            case `${ESC}[A`: // Up arrow
            case 'w':
            case 'W':
                this.tryRotate();
                this.render(context);
                break;

            // Move left
            case `${ESC}[D`: // Left arrow
            case 'a':
            case 'A':
                this.tryMove(-1, 0);
                this.render(context);
                break;

            // Move right
            case `${ESC}[C`: // Right arrow
            case 'd':
            case 'D':
                this.tryMove(1, 0);
                this.render(context);
                break;

            // Soft drop (move down)
            case `${ESC}[B`: // Down arrow
            case 's':
            case 'S':
                if (this.tryMove(0, 1)) {
                    this.score += 1; // soft drop bonus
                }
                this.render(context);
                break;

            // Hard drop
            case ' ':
                if (!this.paused) {
                    this.hardDrop();
                    this.render(context);
                }
                break;

            // Pause
            case 'p':
            case 'P':
                this.paused = !this.paused;
                this.render(context);
                break;

            // Quit
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
            `  ${writer.wrapInColor('tetris', CliForegroundColor.Cyan)}                Start the game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('tetris scores', CliForegroundColor.Cyan)}         View high scores`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('tetris reset', CliForegroundColor.Cyan)}          Reset high scores`,
        );
        writer.writeln();
        writer.writeln('Controls:');
        writer.writeln(
            `  ${writer.wrapInColor('Left/Right / A/D', CliForegroundColor.Yellow)}    Move piece`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Up / W', CliForegroundColor.Yellow)}              Rotate piece`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Down / S', CliForegroundColor.Yellow)}            Soft drop`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Space', CliForegroundColor.Yellow)}               Hard drop`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('P', CliForegroundColor.Yellow)}                   Pause / Resume`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Esc', CliForegroundColor.Yellow)}                 Quit game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('R', CliForegroundColor.Yellow)}                   Restart (after game over)`,
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
                            '  TETRIS HIGH SCORES',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    context.writer.writeln();

                    const sorted = [...this.highScores]
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 10);

                    sorted.forEach((entry, i) => {
                        const rank = `${i + 1}`.padStart(2);
                        const score = `${entry.score}`.padStart(8);
                        const lvl = `Lv${entry.level}`.padStart(4);
                        const lines = `${entry.lines}L`.padStart(4);
                        const medal =
                            i === 0 ? ' \uD83E\uDD47' : i === 1 ? ' \uD83E\uDD48' : i === 2 ? ' \uD83E\uDD49' : '   ';
                        context.writer.writeln(
                            `  ${rank}. ${context.writer.wrapInColor(score, CliForegroundColor.Cyan)}  ${lvl}  ${lines}  ${entry.date}${medal}`,
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
                    context.state.updateState({ tetrisHighScores: [] });
                    await context.state.persist();
                    context.writer.writeSuccess('High scores have been reset.');
                },
            },
        ];
    }

    // ── Game lifecycle ───────────────────────────────────────────────

    private startGame(context: ICliExecutionContext): void {
        this.computeLayout(context);
        this.resetGameState();

        context.enterFullScreenMode(this);
        this.scheduleGameLoop(context);
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

    onDispose(context: ICliExecutionContext): void {
        this.gameLoopTimer = null;
    }

    private resetGameState(): void {
        // Initialize empty board
        this.board = [];
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            this.board[y] = new Array(BOARD_WIDTH).fill(null);
        }

        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.gameOver = false;
        this.paused = false;
        this.currentSpeed = INITIAL_SPEED_MS;
        this.nextPieceType = this.randomPieceType();
        this.spawnPiece();
    }

    private computeLayout(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;

        // Board is BOARD_WIDTH cells * 3 chars each + 2 border chars
        // Plus HUD panel on the right: ~18 chars
        const totalWidth = BOARD_WIDTH * 3 + 2 + 18;
        this.offsetX = Math.max(1, Math.floor((cols - totalWidth) / 2));
        this.offsetY = Math.max(1, Math.floor((rows - BOARD_HEIGHT - 4) / 2));
    }

    // ── Game loop ────────────────────────────────────────────────────

    private scheduleGameLoop(context?: ICliExecutionContext): void {
        if (this.gameLoopTimer) {
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

        // Try to move piece down
        if (!this.tryMove(0, 1)) {
            // Piece can't move down -- lock it
            this.lockPiece();
            const cleared = this.clearLines();
            this.updateScore(cleared);
            this.spawnPiece();

            if (this.gameOver) {
                this.handleGameOver();
            }
        }

        this.render(this.context);
    }

    // ── Piece management ─────────────────────────────────────────────

    private randomPieceType(): string {
        return PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
    }

    private spawnPiece(): void {
        const type = this.nextPieceType;
        this.nextPieceType = this.randomPieceType();

        this.currentPiece = {
            type,
            rotation: 0,
            x: Math.floor((BOARD_WIDTH - 4) / 2),
            y: 0,
        };

        // Check if the new piece collides immediately -> game over
        if (!this.isValidPosition(this.currentPiece)) {
            this.gameOver = true;
        }
    }

    private getPieceBlocks(piece: ActivePiece): Point[] {
        const def = TETROMINOES[piece.type];
        const offsets = def.rotations[piece.rotation];
        return offsets.map((o) => ({
            x: piece.x + o.x,
            y: piece.y + o.y,
        }));
    }

    private isValidPosition(piece: ActivePiece): boolean {
        const blocks = this.getPieceBlocks(piece);
        for (const b of blocks) {
            if (b.x < 0 || b.x >= BOARD_WIDTH || b.y >= BOARD_HEIGHT) {
                return false;
            }
            // Allow blocks above the board (y < 0) during spawn
            if (b.y >= 0 && this.board[b.y][b.x] !== null) {
                return false;
            }
        }
        return true;
    }

    private tryMove(dx: number, dy: number): boolean {
        if (!this.currentPiece || this.paused) return false;

        const test: ActivePiece = {
            ...this.currentPiece,
            x: this.currentPiece.x + dx,
            y: this.currentPiece.y + dy,
        };

        if (this.isValidPosition(test)) {
            this.currentPiece = test;
            return true;
        }
        return false;
    }

    private tryRotate(): void {
        if (!this.currentPiece || this.paused) return;

        const newRotation = (this.currentPiece.rotation + 1) % 4;

        // Try wall kicks
        for (const kick of WALL_KICKS) {
            const test: ActivePiece = {
                ...this.currentPiece,
                rotation: newRotation,
                x: this.currentPiece.x + kick.x,
                y: this.currentPiece.y + kick.y,
            };

            if (this.isValidPosition(test)) {
                this.currentPiece = test;
                return;
            }
        }
    }

    private hardDrop(): void {
        if (!this.currentPiece || this.paused) return;

        let dropDistance = 0;
        while (this.tryMove(0, 1)) {
            dropDistance++;
        }
        this.score += dropDistance * 2; // hard drop bonus

        // Lock immediately
        this.lockPiece();
        const cleared = this.clearLines();
        this.updateScore(cleared);
        this.spawnPiece();

        if (this.gameOver && this.context) {
            this.handleGameOver();
        }
    }

    private getGhostY(): number {
        if (!this.currentPiece) return 0;

        let ghostY = this.currentPiece.y;
        const test: ActivePiece = { ...this.currentPiece };

        while (true) {
            test.y = ghostY + 1;
            if (!this.isValidPosition(test)) break;
            ghostY++;
        }

        return ghostY;
    }

    private lockPiece(): void {
        if (!this.currentPiece) return;

        const def = TETROMINOES[this.currentPiece.type];
        const blocks = this.getPieceBlocks(this.currentPiece);

        for (const b of blocks) {
            if (b.y >= 0 && b.y < BOARD_HEIGHT && b.x >= 0 && b.x < BOARD_WIDTH) {
                this.board[b.y][b.x] = def.color;
            }
        }

        this.currentPiece = null;
    }

    // ── Line clearing ────────────────────────────────────────────────

    private clearLines(): number {
        let cleared = 0;

        for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.board[y].every((cell) => cell !== null)) {
                // Remove this line
                this.board.splice(y, 1);
                // Add empty line at top
                this.board.unshift(new Array(BOARD_WIDTH).fill(null));
                cleared++;
                y++; // Re-check same row index since lines shifted down
            }
        }

        return cleared;
    }

    private updateScore(linesJustCleared: number): void {
        if (linesJustCleared > 0) {
            const points = LINE_SCORES[Math.min(linesJustCleared, 4)] ?? linesJustCleared * 100;
            this.score += points * this.level;
            this.linesCleared += linesJustCleared;

            // Level up every 10 lines
            const newLevel = Math.floor(this.linesCleared / 10) + 1;
            if (newLevel !== this.level) {
                this.level = newLevel;
                this.currentSpeed = Math.max(
                    MIN_SPEED_MS,
                    INITIAL_SPEED_MS - (this.level - 1) * SPEED_DECREASE_PER_LEVEL,
                );
                this.gameLoopTimer?.setDelay(this.currentSpeed);
            }
        }
    }

    // ── Game over ────────────────────────────────────────────────────

    private async handleGameOver(): Promise<void> {
        this.gameOver = true;
        this.gameLoopTimer?.clear();
        this.gameLoopTimer = null;

        if (this.score > 0) {
            this.highScores.push({
                score: this.score,
                level: this.level,
                lines: this.linesCleared,
                date: new Date().toLocaleDateString(),
            });

            this.highScores.sort((a, b) => b.score - a.score);
            this.highScores = this.highScores.slice(0, 20);

            if (this.context) {
                this.context.state.updateState({
                    tetrisHighScores: this.highScores,
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
                this.computeLayout(context);
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

        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        // ── Title bar ────────────────────────────────────────────────
        const boardDisplayWidth = BOARD_WIDTH * 3 + 2; // cells + borders
        const title = ' TETRIS ';
        const titlePad = Math.max(
            0,
            Math.floor((boardDisplayWidth - title.length) / 2),
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
                Math.max(0, boardDisplayWidth - 2 - titlePad - title.length),
            ),
            BOX.topRight,
            ansi.reset,
        );

        // ── Build occupied set for current piece & ghost ─────────────
        const pieceBlocks = new Map<string, string>();
        const ghostBlocks = new Set<string>();

        if (this.currentPiece) {
            const def = TETROMINOES[this.currentPiece.type];

            // Ghost piece
            const ghostY = this.getGhostY();
            if (ghostY !== this.currentPiece.y) {
                const ghostPiece: ActivePiece = { ...this.currentPiece, y: ghostY };
                const gBlocks = this.getPieceBlocks(ghostPiece);
                for (const b of gBlocks) {
                    if (b.y >= 0) {
                        ghostBlocks.add(`${b.x},${b.y}`);
                    }
                }
            }

            // Current piece
            const blocks = this.getPieceBlocks(this.currentPiece);
            for (const b of blocks) {
                if (b.y >= 0) {
                    pieceBlocks.set(`${b.x},${b.y}`, def.color);
                }
            }
        }

        // ── Board rows ───────────────────────────────────────────────
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            const row = this.offsetY + 1 + y;
            buf.push(ansi.cursorTo(row, this.offsetX));
            buf.push(ansi.fg.cyan, BOX.vertical, ansi.reset);

            for (let x = 0; x < BOARD_WIDTH; x++) {
                const key = `${x},${y}`;
                const pieceColor = pieceBlocks.get(key);
                const boardColor = this.board[y][x];

                if (pieceColor) {
                    buf.push(pieceColor, BLOCK_CHAR, ansi.reset);
                } else if (boardColor) {
                    buf.push(boardColor, BLOCK_CHAR, ansi.reset);
                } else if (ghostBlocks.has(key)) {
                    buf.push(ansi.fg.gray, GHOST_CHAR, ansi.reset);
                } else {
                    buf.push(EMPTY_CELL);
                }
            }

            buf.push(ansi.fg.cyan, BOX.vertical, ansi.reset);
        }

        // ── Bottom border ────────────────────────────────────────────
        const bottomRow = this.offsetY + 1 + BOARD_HEIGHT;
        buf.push(ansi.cursorTo(bottomRow, this.offsetX));
        buf.push(
            ansi.fg.cyan,
            BOX.bottomLeft,
            BOX.horizontal.repeat(BOARD_WIDTH * 3),
            BOX.bottomRight,
            ansi.reset,
        );

        // ── HUD panel (right side) ──────────────────────────────────
        const hudX = this.offsetX + boardDisplayWidth + 2;
        const hudStartY = this.offsetY;

        // Score
        buf.push(ansi.cursorTo(hudStartY, hudX));
        buf.push(ansi.fg.white, ansi.bold, 'SCORE', ansi.reset);
        buf.push(ansi.cursorTo(hudStartY + 1, hudX));
        buf.push(ansi.fg.yellow, ansi.bold, `${this.score}`, ansi.reset);

        // Level
        buf.push(ansi.cursorTo(hudStartY + 3, hudX));
        buf.push(ansi.fg.white, ansi.bold, 'LEVEL', ansi.reset);
        buf.push(ansi.cursorTo(hudStartY + 4, hudX));
        buf.push(ansi.fg.green, ansi.bold, `${this.level}`, ansi.reset);

        // Lines
        buf.push(ansi.cursorTo(hudStartY + 6, hudX));
        buf.push(ansi.fg.white, ansi.bold, 'LINES', ansi.reset);
        buf.push(ansi.cursorTo(hudStartY + 7, hudX));
        buf.push(ansi.fg.cyan, ansi.bold, `${this.linesCleared}`, ansi.reset);

        // Next piece
        buf.push(ansi.cursorTo(hudStartY + 9, hudX));
        buf.push(ansi.fg.white, ansi.bold, 'NEXT', ansi.reset);
        this.renderNextPiece(buf, hudX, hudStartY + 10);

        // Best score
        const bestScore = this.highScores.length > 0 ? this.highScores[0].score : 0;
        buf.push(ansi.cursorTo(hudStartY + 15, hudX));
        buf.push(ansi.fg.white, ansi.bold, 'BEST', ansi.reset);
        buf.push(ansi.cursorTo(hudStartY + 16, hudX));
        buf.push(ansi.fg.gray, `${bestScore}`, ansi.reset);

        // ── Controls hint ────────────────────────────────────────────
        buf.push(ansi.cursorTo(bottomRow + 1, this.offsetX));
        buf.push(
            ansi.dim,
            '  [A/D] Move  [W] Rotate  [S] Drop',
            ansi.reset,
        );
        buf.push(ansi.cursorTo(bottomRow + 2, this.offsetX));
        buf.push(
            ansi.dim,
            '  [Space] Hard Drop  [P] Pause  [Esc] Quit',
            ansi.reset,
        );

        // ── Overlays ─────────────────────────────────────────────────
        if (this.gameOver) {
            this.renderGameOverOverlay(buf);
        }

        if (this.paused && !this.gameOver) {
            this.renderPauseOverlay(buf);
        }

        context.terminal.write(buf.join(''));
    }

    private renderNextPiece(buf: string[], hudX: number, startY: number): void {
        const def = TETROMINOES[this.nextPieceType];
        const offsets = def.rotations[0];

        // Find bounding box for centering
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        for (const o of offsets) {
            minX = Math.min(minX, o.x);
            maxX = Math.max(maxX, o.x);
            minY = Math.min(minY, o.y);
            maxY = Math.max(maxY, o.y);
        }

        // Render in a 4x4 preview area
        const blockSet = new Set(offsets.map((o) => `${o.x},${o.y}`));

        for (let py = minY; py <= maxY; py++) {
            buf.push(ansi.cursorTo(startY + (py - minY), hudX));
            for (let px = minX; px <= maxX; px++) {
                if (blockSet.has(`${px},${py}`)) {
                    buf.push(def.color, BLOCK_CHAR, ansi.reset);
                } else {
                    buf.push(EMPTY_CELL);
                }
            }
        }
    }

    private renderGameOverOverlay(buf: string[]): void {
        const centerY = this.offsetY + Math.floor(BOARD_HEIGHT / 2);
        const boxWidth = 24;
        const boxLeft = this.offsetX + Math.floor((BOARD_WIDTH * 3 + 2 - boxWidth) / 2);

        buf.push(ansi.cursorTo(centerY - 3, boxLeft));
        buf.push(
            ansi.fg.red,
            BOX.topLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.topRight,
        );

        buf.push(ansi.cursorTo(centerY - 2, boxLeft));
        buf.push(BOX.vertical);
        buf.push(ansi.bold, '     GAME OVER!     '.padEnd(boxWidth - 2), ansi.reset, ansi.fg.red);
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY - 1, boxLeft));
        buf.push(BOX.vertical);
        const scoreText = `   Score: ${this.score}`;
        buf.push(ansi.reset, ansi.fg.yellow, scoreText.padEnd(boxWidth - 2), ansi.fg.red);
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY, boxLeft));
        buf.push(BOX.vertical);
        const levelText = `   Level: ${this.level}  Lines: ${this.linesCleared}`;
        buf.push(ansi.reset, ansi.fg.cyan, levelText.padEnd(boxWidth - 2), ansi.fg.red);
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY + 1, boxLeft));
        buf.push(BOX.vertical);
        buf.push(ansi.reset, ansi.dim, '  [R] Retry  [Q] Quit '.padEnd(boxWidth - 2), ansi.reset, ansi.fg.red);
        buf.push(BOX.vertical);

        buf.push(ansi.cursorTo(centerY + 2, boxLeft));
        buf.push(
            BOX.bottomLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.bottomRight,
            ansi.reset,
        );
    }

    private renderPauseOverlay(buf: string[]): void {
        const centerY = this.offsetY + Math.floor(BOARD_HEIGHT / 2);
        const boxWidth = 20;
        const boxLeft = this.offsetX + Math.floor((BOARD_WIDTH * 3 + 2 - boxWidth) / 2);

        buf.push(ansi.cursorTo(centerY - 1, boxLeft));
        buf.push(
            ansi.fg.yellow,
            BOX.topLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.topRight,
        );

        buf.push(ansi.cursorTo(centerY, boxLeft));
        buf.push(BOX.vertical);
        buf.push(ansi.bold, '     PAUSED     '.padEnd(boxWidth - 2), ansi.reset, ansi.fg.yellow);
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

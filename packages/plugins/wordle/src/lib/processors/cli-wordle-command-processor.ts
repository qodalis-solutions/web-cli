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
import { WORD_LIST } from '../words';

// ── Types ────────────────────────────────────────────────────────────

enum LetterStatus {
    Correct = 'correct',     // Green  - right letter, right position
    Present = 'present',     // Yellow - right letter, wrong position
    Absent = 'absent',       // Gray   - letter not in word
    Unused = 'unused',       // Not yet guessed
}

interface WordleStats {
    gamesPlayed: number;
    gamesWon: number;
    currentStreak: number;
    maxStreak: number;
    guessDistribution: number[];
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
        black: `${CSI}30m`,
        brightWhite: `${CSI}97m`,
        reset: `${CSI}0m`,
    },
    bg: {
        green: `${CSI}42m`,
        yellow: `${CSI}43m`,
        gray: `${CSI}100m`,
        darkGray: `${CSI}48;5;239m`,
        white: `${CSI}47m`,
        red: `${CSI}41m`,
        cyan: `${CSI}46m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    reset: `${CSI}0m`,
};

// ── Constants ────────────────────────────────────────────────────────

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

// Box-drawing characters
const BOX = {
    topLeft: '\u250C',     // +
    topRight: '\u2510',    // +
    bottomLeft: '\u2514',  // +
    bottomRight: '\u2518', // +
    horizontal: '\u2500',  // -
    vertical: '\u2502',    // |
    teeDown: '\u252C',     // T
    teeUp: '\u2534',       // +
    teeRight: '\u251C',    // +
    teeLeft: '\u2524',     // +
    cross: '\u253C',       // +
};

const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

// ── Processor ────────────────────────────────────────────────────────

export class CliWordleCommandProcessor implements ICliCommandProcessor {
    command = 'wordle';

    description = 'Play the classic Wordle word-guessing game in your terminal';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        module: 'games',
        icon: '\uD83D\uDCDD', // memo emoji
        requiredCoreVersion: '0.0.16',
        requiredCliVersion: '1.0.37',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            wordleStats: {
                gamesPlayed: 0,
                gamesWon: 0,
                currentStreak: 0,
                maxStreak: 0,
                guessDistribution: [0, 0, 0, 0, 0, 0],
            },
        },
    };

    // ── Game state ───────────────────────────────────────────────────

    private targetWord = '';
    private guesses: string[] = [];
    private currentInput = '';
    private gameOver = false;
    private gameWon = false;
    private invalidGuessMessage = '';
    private keyboardStatus: Map<string, LetterStatus> = new Map();
    private stats: WordleStats = {
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: [0, 0, 0, 0, 0, 0],
    };
    private context: ICliExecutionContext | null = null;

    // Layout
    private offsetX = 0;
    private offsetY = 0;

    constructor() {
        this.registerSubProcessors();
    }

    // ── Lifecycle ────────────────────────────────────────────────────

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<WordleStats>((x) => x['wordleStats'])
            .subscribe((stats) => {
                if (stats) {
                    this.stats = { ...stats };
                }
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
        // Clear any previous invalid guess message on new input
        this.invalidGuessMessage = '';

        if (this.gameOver) {
            this.handleGameOverInput(data, context);
            return;
        }

        // Quit (only Esc during gameplay — Q is a valid letter!)
        if (data === ESC) {
            this.stopGame(context);
            return;
        }

        // Backspace
        if (data === '\x7f' || data === '\b') {
            if (this.currentInput.length > 0) {
                this.currentInput = this.currentInput.slice(0, -1);
            }
            this.render(context);
            return;
        }

        // Enter - submit guess
        if (data === '\r' || data === '\n') {
            if (this.currentInput.length === WORD_LENGTH) {
                this.submitGuess(context);
            }
            return;
        }

        // Letter input (a-z, A-Z)
        if (/^[a-zA-Z]$/.test(data)) {
            if (this.currentInput.length < WORD_LENGTH) {
                this.currentInput += data.toLowerCase();
            }
            this.render(context);
            return;
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('wordle', CliForegroundColor.Cyan)}                Start the game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('wordle stats', CliForegroundColor.Cyan)}          View statistics`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('wordle reset', CliForegroundColor.Cyan)}          Reset statistics`,
        );
        writer.writeln();
        writer.writeln('Controls:');
        writer.writeln(
            `  ${writer.wrapInColor('A-Z', CliForegroundColor.Yellow)}                Type a letter`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Backspace', CliForegroundColor.Yellow)}          Delete last letter`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Enter', CliForegroundColor.Yellow)}              Submit guess (5 letters)`,
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
                command: 'stats',
                description: 'View game statistics',
                processCommand: async (_, context) => {
                    const s = this.stats;
                    const winPct =
                        s.gamesPlayed > 0
                            ? Math.round((s.gamesWon / s.gamesPlayed) * 100)
                            : 0;

                    context.writer.writeln();
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            '  WORDLE STATISTICS',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    context.writer.writeln();
                    context.writer.writeln(
                        `  Games Played:    ${context.writer.wrapInColor(`${s.gamesPlayed}`, CliForegroundColor.Cyan)}`,
                    );
                    context.writer.writeln(
                        `  Win %:           ${context.writer.wrapInColor(`${winPct}%`, CliForegroundColor.Cyan)}`,
                    );
                    context.writer.writeln(
                        `  Current Streak:  ${context.writer.wrapInColor(`${s.currentStreak}`, CliForegroundColor.Cyan)}`,
                    );
                    context.writer.writeln(
                        `  Max Streak:      ${context.writer.wrapInColor(`${s.maxStreak}`, CliForegroundColor.Cyan)}`,
                    );
                    context.writer.writeln();
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            '  GUESS DISTRIBUTION',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    context.writer.writeln();

                    const maxDist = Math.max(...s.guessDistribution, 1);
                    for (let i = 0; i < 6; i++) {
                        const count = s.guessDistribution[i];
                        const barLen = Math.max(
                            1,
                            Math.round((count / maxDist) * 20),
                        );
                        const bar = '\u2588'.repeat(barLen);
                        context.writer.writeln(
                            `  ${i + 1}: ${context.writer.wrapInColor(bar, CliForegroundColor.Green)} ${count}`,
                        );
                    }
                    context.writer.writeln();
                },
            },
            {
                command: 'reset',
                description: 'Reset all statistics',
                processCommand: async (_, context) => {
                    this.stats = {
                        gamesPlayed: 0,
                        gamesWon: 0,
                        currentStreak: 0,
                        maxStreak: 0,
                        guessDistribution: [0, 0, 0, 0, 0, 0],
                    };
                    context.state.updateState({ wordleStats: this.stats });
                    await context.state.persist();
                    context.writer.writeSuccess(
                        'Wordle statistics have been reset.',
                    );
                },
            },
        ];
    }

    // ── Game lifecycle ───────────────────────────────────────────────

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

    onDispose(context: ICliExecutionContext): void {
        // Cleanup — engine already handles managed timers
    }

    private resetGameState(): void {
        this.targetWord =
            WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        this.guesses = [];
        this.currentInput = '';
        this.gameOver = false;
        this.gameWon = false;
        this.invalidGuessMessage = '';
        this.keyboardStatus = new Map();
    }

    private computeLayout(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;

        // Grid is 5 cells wide, each cell 5 chars + borders = 5*5 + 6 = 31 chars wide
        const gridWidth = WORD_LENGTH * 5 + WORD_LENGTH + 1;
        this.offsetX = Math.max(1, Math.floor((cols - gridWidth) / 2));

        // Vertically: title(2) + grid(6*4=24) + gap(1) + message(2) + keyboard(9) + hud(2) + controls(1) = ~41
        const totalHeight = 41;
        this.offsetY = Math.max(1, Math.floor((rows - totalHeight) / 2));
    }

    // ── Guess submission ─────────────────────────────────────────────

    private submitGuess(context: ICliExecutionContext): void {
        const guess = this.currentInput.toLowerCase();

        // Validate guess is in word list
        if (!WORD_LIST.includes(guess)) {
            this.invalidGuessMessage = 'Not in word list!';
            this.render(context);
            return;
        }

        // Evaluate the guess
        const evaluation = this.evaluateGuess(guess);

        // Update keyboard status
        for (let i = 0; i < WORD_LENGTH; i++) {
            const letter = guess[i].toUpperCase();
            const status = evaluation[i];
            const current = this.keyboardStatus.get(letter) ?? LetterStatus.Unused;

            // Green > Yellow > Gray > Unused
            if (
                status === LetterStatus.Correct ||
                (status === LetterStatus.Present &&
                    current !== LetterStatus.Correct) ||
                (status === LetterStatus.Absent &&
                    current === LetterStatus.Unused)
            ) {
                this.keyboardStatus.set(letter, status);
            }
        }

        this.guesses.push(guess);
        this.currentInput = '';

        // Check win/loss
        if (guess === this.targetWord) {
            this.gameOver = true;
            this.gameWon = true;
            this.updateStats(true, this.guesses.length);
        } else if (this.guesses.length >= MAX_GUESSES) {
            this.gameOver = true;
            this.gameWon = false;
            this.updateStats(false, 0);
        }

        this.render(context);
    }

    private evaluateGuess(guess: string): LetterStatus[] {
        const result: LetterStatus[] = new Array(WORD_LENGTH).fill(
            LetterStatus.Absent,
        );
        const targetLetters = this.targetWord.split('');
        const guessLetters = guess.split('');

        // Track which target letters have been matched
        const matched = new Array(WORD_LENGTH).fill(false);

        // First pass: mark correct positions (green)
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (guessLetters[i] === targetLetters[i]) {
                result[i] = LetterStatus.Correct;
                matched[i] = true;
            }
        }

        // Second pass: mark present letters (yellow)
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (result[i] === LetterStatus.Correct) continue;

            for (let j = 0; j < WORD_LENGTH; j++) {
                if (!matched[j] && guessLetters[i] === targetLetters[j]) {
                    result[i] = LetterStatus.Present;
                    matched[j] = true;
                    break;
                }
            }
        }

        return result;
    }

    private async updateStats(
        won: boolean,
        guessCount: number,
    ): Promise<void> {
        this.stats.gamesPlayed++;

        if (won) {
            this.stats.gamesWon++;
            this.stats.currentStreak++;
            if (this.stats.currentStreak > this.stats.maxStreak) {
                this.stats.maxStreak = this.stats.currentStreak;
            }
            if (guessCount >= 1 && guessCount <= 6) {
                this.stats.guessDistribution[guessCount - 1]++;
            }
        } else {
            this.stats.currentStreak = 0;
        }

        if (this.context) {
            this.context.state.updateState({ wordleStats: { ...this.stats } });
            await this.context.state.persist();
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

        let row = this.offsetY;

        // ── Title ────────────────────────────────────────────────────
        const gridWidth = WORD_LENGTH * 5 + WORD_LENGTH + 1; // 31
        const title = 'W O R D L E';
        const titlePad = Math.max(
            0,
            Math.floor((gridWidth - title.length) / 2),
        );
        buf.push(ansi.cursorTo(row, this.offsetX + titlePad));
        buf.push(ansi.bold, ansi.fg.green, title, ansi.reset);
        row += 2;

        // ── Guess grid ───────────────────────────────────────────────
        for (let g = 0; g < MAX_GUESSES; g++) {
            row = this.renderGuessRow(buf, row, g);
        }

        row += 1;

        // ── Invalid guess message ────────────────────────────────────
        if (this.invalidGuessMessage) {
            const msgPad = Math.max(
                0,
                Math.floor(
                    (gridWidth - this.invalidGuessMessage.length) / 2,
                ),
            );
            buf.push(ansi.cursorTo(row, this.offsetX + msgPad));
            buf.push(
                ansi.bold,
                ansi.fg.red,
                this.invalidGuessMessage,
                ansi.reset,
            );
        }
        row += 1;

        // ── Game over message ────────────────────────────────────────
        if (this.gameOver) {
            row = this.renderGameOverMessage(buf, row);
        }

        row += 1;

        // ── Keyboard ─────────────────────────────────────────────────
        row = this.renderKeyboard(buf, row);

        row += 1;

        // ── HUD ──────────────────────────────────────────────────────
        const winPct =
            this.stats.gamesPlayed > 0
                ? Math.round(
                      (this.stats.gamesWon / this.stats.gamesPlayed) * 100,
                  )
                : 0;
        buf.push(ansi.cursorTo(row, this.offsetX));
        buf.push(
            ansi.dim,
            `Played: ${this.stats.gamesPlayed}  Win: ${winPct}%  Streak: ${this.stats.currentStreak}  Max: ${this.stats.maxStreak}`,
            ansi.reset,
        );
        row += 1;

        // ── Controls hint ────────────────────────────────────────────
        buf.push(ansi.cursorTo(row, this.offsetX));
        if (this.gameOver) {
            buf.push(
                ansi.dim,
                '[R] New Game  [Q] Quit',
                ansi.reset,
            );
        } else {
            buf.push(
                ansi.dim,
                '[A-Z] Type  [Backspace] Delete  [Enter] Submit  [Esc] Quit',
                ansi.reset,
            );
        }

        context.terminal.write(buf.join(''));
    }

    private renderGuessRow(
        buf: string[],
        startRow: number,
        guessIndex: number,
    ): number {
        const isCurrentRow =
            !this.gameOver && guessIndex === this.guesses.length;
        const isSubmitted = guessIndex < this.guesses.length;

        let guess = '';
        let evaluation: LetterStatus[] = [];

        if (isSubmitted) {
            guess = this.guesses[guessIndex];
            evaluation = this.evaluateGuess(guess);
        } else if (isCurrentRow) {
            guess = this.currentInput;
        }

        const cellWidth = 5; // chars per cell content

        // Top border of cells
        buf.push(ansi.cursorTo(startRow, this.offsetX));
        buf.push(ansi.fg.gray);
        for (let c = 0; c < WORD_LENGTH; c++) {
            buf.push(
                c === 0 ? BOX.topLeft : BOX.teeDown,
                BOX.horizontal.repeat(cellWidth),
            );
        }
        buf.push(BOX.topRight, ansi.reset);

        // Padding row (row 1 of 3 content rows) - shows background color
        buf.push(ansi.cursorTo(startRow + 1, this.offsetX));
        for (let c = 0; c < WORD_LENGTH; c++) {
            buf.push(ansi.fg.gray, BOX.vertical, ansi.reset);

            if (isSubmitted && evaluation[c] !== undefined) {
                const bgColor = this.getStatusBgColor(evaluation[c]);
                buf.push(bgColor, ' '.repeat(cellWidth), ansi.reset);
            } else {
                buf.push(' '.repeat(cellWidth));
            }
        }
        buf.push(ansi.fg.gray, BOX.vertical, ansi.reset);

        // Letter row (row 2 of 3 content rows) - centered letter with background
        buf.push(ansi.cursorTo(startRow + 2, this.offsetX));
        for (let c = 0; c < WORD_LENGTH; c++) {
            buf.push(ansi.fg.gray, BOX.vertical, ansi.reset);

            const letter = guess[c] ?? '';
            const displayLetter = letter.toUpperCase();

            if (isSubmitted && evaluation[c] !== undefined) {
                // Colored cell for submitted guess
                const bgColor = this.getStatusBgColor(evaluation[c]);
                buf.push(
                    bgColor,
                    ansi.fg.white,
                    ansi.bold,
                    `  ${displayLetter}  `,
                    ansi.reset,
                );
            } else if (isCurrentRow && c < this.currentInput.length) {
                // Current input letter
                buf.push(
                    ansi.bold,
                    ansi.fg.white,
                    `  ${displayLetter}  `,
                    ansi.reset,
                );
            } else if (isCurrentRow && c === this.currentInput.length) {
                // Cursor position
                buf.push(ansi.fg.gray, '  _  ', ansi.reset);
            } else {
                // Empty cell
                buf.push(' '.repeat(cellWidth));
            }
        }
        buf.push(ansi.fg.gray, BOX.vertical, ansi.reset);

        // Padding row (row 3 of 3 content rows) - shows background color
        buf.push(ansi.cursorTo(startRow + 3, this.offsetX));
        for (let c = 0; c < WORD_LENGTH; c++) {
            buf.push(ansi.fg.gray, BOX.vertical, ansi.reset);

            if (isSubmitted && evaluation[c] !== undefined) {
                const bgColor = this.getStatusBgColor(evaluation[c]);
                buf.push(bgColor, ' '.repeat(cellWidth), ansi.reset);
            } else {
                buf.push(' '.repeat(cellWidth));
            }
        }
        buf.push(ansi.fg.gray, BOX.vertical, ansi.reset);

        // Bottom border of cells
        buf.push(ansi.cursorTo(startRow + 4, this.offsetX));
        buf.push(ansi.fg.gray);
        for (let c = 0; c < WORD_LENGTH; c++) {
            buf.push(
                c === 0 ? BOX.bottomLeft : BOX.teeUp,
                BOX.horizontal.repeat(cellWidth),
            );
        }
        buf.push(BOX.bottomRight, ansi.reset);

        return startRow + 5;
    }

    private renderGameOverMessage(
        buf: string[],
        row: number,
    ): number {
        const gridWidth = WORD_LENGTH * 5 + WORD_LENGTH + 1;

        if (this.gameWon) {
            const messages = [
                'Genius!',
                'Magnificent!',
                'Impressive!',
                'Splendid!',
                'Great!',
                'Phew!',
            ];
            const msg = messages[Math.min(this.guesses.length - 1, 5)];
            const padLen = Math.max(
                0,
                Math.floor((gridWidth - msg.length) / 2),
            );
            buf.push(ansi.cursorTo(row, this.offsetX + padLen));
            buf.push(ansi.bold, ansi.fg.brightGreen, msg, ansi.reset);
        } else {
            const word = this.targetWord.toUpperCase();
            const msg = `The word was: ${word}`;
            const padLen = Math.max(
                0,
                Math.floor((gridWidth - msg.length) / 2),
            );
            buf.push(ansi.cursorTo(row, this.offsetX + padLen));
            buf.push(ansi.bold, ansi.fg.red, msg, ansi.reset);
        }

        return row + 1;
    }

    private renderKeyboard(buf: string[], startRow: number): number {
        const gridWidth = WORD_LENGTH * 5 + WORD_LENGTH + 1;
        let row = startRow;

        for (const keyRow of KEYBOARD_ROWS) {
            // Each key is 5 chars wide + 1 space = 6 per key
            const rowWidth = keyRow.length * 6 - 1;
            const padLeft =
                this.offsetX + Math.max(0, Math.floor((gridWidth - rowWidth) / 2));

            buf.push(ansi.cursorTo(row, padLeft));

            for (let k = 0; k < keyRow.length; k++) {
                const key = keyRow[k];
                const status =
                    this.keyboardStatus.get(key) ?? LetterStatus.Unused;

                if (k > 0) {
                    buf.push(' ');
                }

                const bgColor = this.getKeyboardBgColor(status);
                const fgColor = this.getKeyboardFgColor(status);
                buf.push(bgColor, fgColor, ansi.bold, `  ${key}  `, ansi.reset);
            }

            row += 3;
        }

        return row;
    }

    private getStatusBgColor(status: LetterStatus): string {
        switch (status) {
            case LetterStatus.Correct:
                return ansi.bg.green;
            case LetterStatus.Present:
                return ansi.bg.yellow;
            case LetterStatus.Absent:
                return ansi.bg.darkGray;
            default:
                return '';
        }
    }

    private getKeyboardBgColor(status: LetterStatus): string {
        switch (status) {
            case LetterStatus.Correct:
                return ansi.bg.green;
            case LetterStatus.Present:
                return ansi.bg.yellow;
            case LetterStatus.Absent:
                return ansi.bg.darkGray;
            case LetterStatus.Unused:
                return ansi.bg.gray;
        }
    }

    private getKeyboardFgColor(status: LetterStatus): string {
        switch (status) {
            case LetterStatus.Correct:
            case LetterStatus.Absent:
                return ansi.fg.white;
            case LetterStatus.Present:
                return ansi.fg.black;
            case LetterStatus.Unused:
                return ansi.fg.white;
        }
    }
}

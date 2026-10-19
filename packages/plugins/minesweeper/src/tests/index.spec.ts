import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { CliMinesweeperCommandProcessor } from '../lib/processors/cli-minesweeper-command-processor';

// ── Fake context ────────────────────────────────────────────

function createContext(initialState: Record<string, any> = {}) {
    const state$ = new BehaviorSubject<Record<string, any>>({
        minesweeperBestTimes: { easy: null, medium: null, hard: null },
        ...initialState,
    });
    const out = { lines: [] as string[], success: [] as string[] };
    const intervals: { clear: jasmine.Spy }[] = [];
    const context: any = {
        terminal: { cols: 120, rows: 40, write: jasmine.createSpy('write') },
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
        createInterval: jasmine.createSpy('createInterval').and.callFake(() => {
            const handle = { clear: jasmine.createSpy('clear'), setDelay: () => {} };
            intervals.push(handle);
            return handle;
        }),
        writer: {
            writeln: (t = '') => out.lines.push(t),
            writeSuccess: (t: string) => out.success.push(t),
            wrapInColor: (t: string) => t,
        },
        state: {
            select: (fn: (s: any) => any) => state$.pipe(map(fn)),
            updateState: jasmine
                .createSpy('updateState')
                .and.callFake((patch: any) =>
                    state$.next({ ...state$.value, ...patch }),
                ),
            persist: jasmine.createSpy('persist').and.resolveTo(),
        },
    };
    return { context, out, state$, intervals };
}

/** Deterministic pseudo-random sequence (LCG) for Math.random. */
function seedRandom(seed: number) {
    let s = seed;
    spyOn(Math, 'random').and.callFake(() => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
    });
}

const ENTER = '\r';

async function start(sub?: 'easy' | 'medium' | 'hard', initialState = {}) {
    const p = new CliMinesweeperCommandProcessor();
    const env = createContext(initialState);
    await p.initialize(env.context);
    if (sub) {
        await p.processors!.find((x) => x.command === sub)!.processCommand({} as any, env.context);
    } else {
        await p.processCommand({ command: 'minesweeper', args: {} } as any, env.context);
    }
    return { p, internal: p as any, ...env };
}

/** Replace the board with a known layout; mines are given as [row, col]. */
function setBoard(internal: any, rows: number, cols: number, mines: [number, number][]) {
    internal.gridRows = rows;
    internal.gridCols = cols;
    internal.totalMines = mines.length;
    internal.grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({ mine: false, revealed: false, flagged: false, adjacentMines: 0 });
        }
        internal.grid.push(row);
    }
    for (const [r, c] of mines) internal.grid[r][c].mine = true;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let n = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if ((dr || dc) && internal.grid[r + dr]?.[c + dc]?.mine) n++;
                }
            }
            internal.grid[r][c].adjacentMines = n;
        }
    }
    internal.firstReveal = false;
}

function revealedCount(internal: any): number {
    return internal.grid.flat().filter((c: any) => c.revealed).length;
}

describe('CliMinesweeperCommandProcessor', () => {
    it('registers the command with aliases, metadata and sub-commands', () => {
        const p = new CliMinesweeperCommandProcessor();
        expect(p.command).toBe('minesweeper');
        expect(p.aliases).toEqual(['mines', 'sweep']);
        expect(p.metadata?.module).toBe('games');
        expect(p.stateConfiguration?.initialState).toEqual({
            minesweeperBestTimes: { easy: null, medium: null, hard: null },
        });
        expect(p.processors!.map((x) => x.command)).toEqual([
            'easy',
            'medium',
            'hard',
            'scores',
            'reset',
        ]);
    });

    it('creates boards sized per difficulty with the cursor centred', async () => {
        const easy = await start();
        expect(easy.internal.grid.length).toBe(9);
        expect(easy.internal.grid[0].length).toBe(9);
        expect(easy.internal.totalMines).toBe(10);
        expect([easy.internal.cursorRow, easy.internal.cursorCol]).toEqual([4, 4]);
        expect(easy.context.enterFullScreenMode).toHaveBeenCalled();

        const medium = await start('medium');
        expect(medium.internal.grid.length).toBe(16);
        expect(medium.internal.grid[0].length).toBe(16);
        expect(medium.internal.totalMines).toBe(40);

        const hard = await start('hard');
        expect(hard.internal.grid.length).toBe(16);
        expect(hard.internal.grid[0].length).toBe(30);
        expect(hard.internal.totalMines).toBe(99);
    });

    it('places mines on the first reveal, away from the first cell, with correct counts', async () => {
        seedRandom(42);
        const { p, internal, context } = await start();
        expect(internal.grid.flat().some((c: any) => c.mine)).toBeFalse();

        await p.onData(ENTER, context);

        const grid = internal.grid;
        expect(grid.flat().filter((c: any) => c.mine).length).toBe(10);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                expect(grid[4 + dr][4 + dc].mine).toBeFalse();
            }
        }
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c].mine) continue;
                let n = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if ((dr || dc) && grid[r + dr]?.[c + dc]?.mine) n++;
                    }
                }
                expect(grid[r][c].adjacentMines).toBe(n);
            }
        }
        expect(internal.gameOver).toBeFalse();
        // The first cell has no adjacent mines, so the reveal floods outwards.
        expect(revealedCount(internal)).toBeGreaterThan(1);
    });

    it('flood-reveals empty areas and stops at numbered cells', async () => {
        const { p, internal, context } = await start();
        // A wall of mines down column 2 splits the 3x5 board.
        setBoard(internal, 3, 5, [[0, 2], [1, 2], [2, 2]]);
        internal.cursorRow = 0;
        internal.cursorCol = 0;

        await p.onData(ENTER, context);

        for (let r = 0; r < 3; r++) {
            expect(internal.grid[r][0].revealed).toBeTrue();
            expect(internal.grid[r][1].revealed).toBeTrue();
            expect(internal.grid[r][3].revealed).toBeFalse();
            expect(internal.grid[r][4].revealed).toBeFalse();
        }
        expect(internal.gameWon).toBeFalse();
    });

    it('revealing a numbered cell reveals only that cell', async () => {
        const { p, internal, context } = await start();
        setBoard(internal, 3, 3, [[0, 0]]);
        internal.cursorRow = 1;
        internal.cursorCol = 1;

        await p.onData(' ', context);

        expect(revealedCount(internal)).toBe(1);
        expect(internal.grid[1][1].revealed).toBeTrue();
    });

    it('toggles flags, protects flagged cells and cannot flag revealed cells', async () => {
        const { p, internal, context } = await start();
        setBoard(internal, 3, 3, [[0, 0]]);
        internal.cursorRow = 2;
        internal.cursorCol = 2;

        await p.onData('f', context);
        expect(internal.grid[2][2].flagged).toBeTrue();
        expect(internal.flagCount).toBe(1);

        await p.onData(ENTER, context);
        expect(internal.grid[2][2].revealed).toBeFalse();

        await p.onData('F', context);
        expect(internal.grid[2][2].flagged).toBeFalse();
        expect(internal.flagCount).toBe(0);

        internal.cursorRow = 1;
        internal.cursorCol = 1;
        await p.onData(ENTER, context);
        await p.onData('f', context);
        expect(internal.grid[1][1].flagged).toBeFalse();
    });

    it('moves the cursor with arrows/WASD and clamps at the edges', async () => {
        const { p, internal, context } = await start();
        internal.cursorRow = 0;
        internal.cursorCol = 0;

        await p.onData('\x1b[A', context); // up (blocked)
        await p.onData('a', context); // left (blocked)
        expect([internal.cursorRow, internal.cursorCol]).toEqual([0, 0]);

        await p.onData('\x1b[B', context);
        await p.onData('d', context);
        await p.onData('\x1b[C', context);
        expect([internal.cursorRow, internal.cursorCol]).toEqual([1, 2]);

        internal.cursorRow = 8;
        internal.cursorCol = 8;
        await p.onData('s', context);
        await p.onData('d', context);
        expect([internal.cursorRow, internal.cursorCol]).toEqual([8, 8]);
    });

    it('loses when a mine is revealed, exposing every mine', async () => {
        const { p, internal, context } = await start();
        setBoard(internal, 3, 3, [[0, 0], [2, 2]]);
        internal.cursorRow = 0;
        internal.cursorCol = 0;

        await p.onData(ENTER, context);

        expect(internal.gameOver).toBeTrue();
        expect([internal.explodedRow, internal.explodedCol]).toEqual([0, 0]);
        expect(internal.grid[2][2].revealed).toBeTrue();
        expect(context.state.updateState).not.toHaveBeenCalled();

        // Input other than restart/quit is ignored
        await p.onData('s', context);
        expect(internal.cursorRow).toBe(0);

        await p.onData('r', context);
        expect(internal.gameOver).toBeFalse();
        expect(internal.firstReveal).toBeTrue();
        expect(internal.grid.length).toBe(9);
    });

    it('wins when every safe cell is revealed, auto-flags mines and saves the best time', async () => {
        const now = spyOn(Date, 'now').and.returnValue(1_000_000);
        const { p, internal, context, state$ } = await start();
        setBoard(internal, 3, 3, [[0, 0]]);
        internal.startTime = 1_000_000;
        now.and.returnValue(1_000_000 + 42_500);

        // reveal (2,2): it has no neighbours with mines, so it floods everything
        internal.cursorRow = 2;
        internal.cursorCol = 2;
        await p.onData(ENTER, context);

        expect(internal.gameWon).toBeTrue();
        expect(internal.grid[0][0].flagged).toBeTrue();
        expect(internal.flagCount).toBe(1);
        expect(state$.value['minesweeperBestTimes']).toEqual({
            easy: 42,
            medium: null,
            hard: null,
        });
        expect(context.state.persist).toHaveBeenCalled();
    });

    it('does not overwrite a better best time', async () => {
        spyOn(Date, 'now').and.returnValue(100_000);
        const { p, internal, context } = await start(undefined, {
            minesweeperBestTimes: { easy: 10, medium: null, hard: null },
        });
        setBoard(internal, 3, 3, [[0, 0]]);
        internal.startTime = 0; // 100 seconds elapsed
        internal.cursorRow = 2;
        internal.cursorCol = 2;

        await p.onData(ENTER, context);

        expect(internal.gameWon).toBeTrue();
        expect(context.state.updateState).not.toHaveBeenCalled();
        expect(internal.bestTimes.easy).toBe(10);
    });

    it('"scores" lists best times per difficulty', async () => {
        const { p, out, context } = await start(undefined, {
            minesweeperBestTimes: { easy: 75, medium: null, hard: 5 },
        });
        await p.processors!.find((x) => x.command === 'scores')!.processCommand({} as any, context);
        const text = out.lines.join('\n');
        expect(text).toMatch(/Easy\s+9x9\s+01:15/);
        expect(text).toMatch(/Medium\s+16x16\s+No record/);
        expect(text).toMatch(/Hard\s+16x30\s+00:05/);
    });

    it('"reset" clears and persists best times', async () => {
        const { p, out, context, state$ } = await start(undefined, {
            minesweeperBestTimes: { easy: 75, medium: 80, hard: 5 },
        });
        await p.processors!.find((x) => x.command === 'reset')!.processCommand({} as any, context);
        expect(state$.value['minesweeperBestTimes']).toEqual({ easy: null, medium: null, hard: null });
        expect(context.state.persist).toHaveBeenCalled();
        expect(out.success.length).toBe(1);
    });

    it('Esc quits full-screen mode and clears the timer', async () => {
        const { p, context, intervals } = await start();
        await p.onData('\x1b', context);
        expect(context.exitFullScreenMode).toHaveBeenCalled();
        expect(intervals[intervals.length - 1].clear).toHaveBeenCalled();
    });
});

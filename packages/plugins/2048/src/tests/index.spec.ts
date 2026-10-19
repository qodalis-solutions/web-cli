import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Cli2048CommandProcessor } from '../lib/processors/cli-2048-command-processor';

// ── Fake context ────────────────────────────────────────────

function createContext(initialState: Record<string, any> = {}) {
    const state$ = new BehaviorSubject<Record<string, any>>({
        game2048HighScores: [],
        ...initialState,
    });
    const out = { info: [] as string[], success: [] as string[], lines: [] as string[] };
    const context: any = {
        terminal: { cols: 80, rows: 30, write: jasmine.createSpy('write') },
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
        writer: {
            writeln: (t = '') => out.lines.push(t),
            writeInfo: (t: string) => out.info.push(t),
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
            getState: () => state$.value,
        },
    };
    return { context, out, state$ };
}

const LEFT = '\x1b[D';
const RIGHT = '\x1b[C';
const UP = '\x1b[A';
const DOWN = '\x1b[B';

/** Starts a game, then replaces the board with a known grid. */
async function startWith(grid: number[][], score = 0) {
    const processor = new Cli2048CommandProcessor();
    const { context, out, state$ } = createContext();
    await processor.initialize(context);
    await processor.processCommand({ command: '2048', args: {} } as any, context);
    const internal = processor as any;
    internal.grid = grid.map((r) => [...r]);
    internal.score = score;
    return { processor, internal, context, out, state$ };
}

/** Make the next spawned tile deterministic: first empty cell, value 2. */
function spawnFirstEmptyAsTwo() {
    spyOn(Math, 'random').and.returnValue(0);
}

describe('Cli2048CommandProcessor', () => {
    describe('metadata', () => {
        it('registers the 2048 command in the games module', () => {
            const p = new Cli2048CommandProcessor();
            expect(p.command).toBe('2048');
            expect(p.metadata?.module).toBe('games');
            expect(p.stateConfiguration?.initialState).toEqual({
                game2048HighScores: [],
            });
            expect(p.processors!.map((x) => x.command)).toEqual([
                'scores',
                'reset',
            ]);
        });
    });

    describe('game start', () => {
        it('enters full-screen mode with a fresh board of two tiles', async () => {
            spyOn(Math, 'random').and.returnValues(0, 0, 0.5, 0.95);
            const p = new Cli2048CommandProcessor();
            const { context } = createContext();
            await p.processCommand({ command: '2048', args: {} } as any, context);

            expect(context.enterFullScreenMode).toHaveBeenCalledWith(p);
            const grid: number[][] = (p as any).grid;
            const tiles = grid.flat().filter((v) => v !== 0);
            expect(tiles.length).toBe(2);
            expect(grid[0][0]).toBe(2);
            expect(tiles).toContain(4);
            expect((p as any).score).toBe(0);
        });
    });

    describe('moves', () => {
        it('slides left and merges pairs once per move, adding to the score', async () => {
            spawnFirstEmptyAsTwo();
            const { internal, context, processor } = await startWith([
                [2, 2, 2, 2],
                [2, 2, 4, 0],
                [0, 4, 0, 4],
                [8, 0, 0, 0],
            ]);

            await processor.onData(LEFT, context);

            // merged row, then the new tile lands in the first empty cell (0,2)
            expect(internal.grid[0]).toEqual([4, 4, 2, 0]);
            expect(internal.grid[1]).toEqual([4, 4, 0, 0]);
            expect(internal.grid[2]).toEqual([8, 0, 0, 0]);
            expect(internal.grid[3]).toEqual([8, 0, 0, 0]);
            // 4 + 4 (row 0) + 4 (row 1) + 8 (row 2)
            expect(internal.score).toBe(20);
        });

        it('slides right, up and down', async () => {
            spawnFirstEmptyAsTwo();
            const { internal, context, processor } = await startWith([
                [2, 2, 0, 4],
                [0, 0, 0, 4],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ]);

            await processor.onData(RIGHT, context);
            // row 0: [0,0,4,4], then spawn at first empty (0,0)
            expect(internal.grid[0]).toEqual([2, 0, 4, 4]);
            expect(internal.grid[1]).toEqual([0, 0, 0, 4]);

            await processor.onData(DOWN, context);
            // col 3: [4,4,0,0] -> [0,0,0,8]; col 2: [4,..] -> bottom; col 0: [2] -> bottom
            expect(internal.grid[3]).toEqual([2, 0, 4, 8]);

            // spawn put a 2 at (0,0); col 0 is now [2,0,0,2] and merges upward
            await processor.onData(UP, context);
            expect(internal.grid[0]).toEqual([4, 2, 4, 8]);
            expect(internal.grid[3]).toEqual([0, 0, 0, 0]);
        });

        it('does not spawn a tile or change anything when a move is impossible', async () => {
            const random = spyOn(Math, 'random').and.returnValue(0);
            const grid = [
                [2, 4, 0, 0],
                [4, 2, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ];
            const { internal, context, processor } = await startWith(grid, 12);
            random.calls.reset();

            await processor.onData(LEFT, context);

            expect(internal.grid).toEqual(grid);
            expect(internal.score).toBe(12);
            expect(random).not.toHaveBeenCalled();
        });

        it('accepts WASD as well as arrow keys', async () => {
            spawnFirstEmptyAsTwo();
            const { internal, context, processor } = await startWith([
                [0, 0, 0, 2],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ]);

            await processor.onData('a', context);
            expect(internal.grid[0][0]).toBe(2);
        });

        it('undo restores the previous board and score (single level)', async () => {
            spawnFirstEmptyAsTwo();
            const start = [
                [2, 2, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ];
            const { internal, context, processor } = await startWith(start, 10);

            await processor.onData(LEFT, context);
            expect(internal.score).toBe(14);

            await processor.onData('u', context);
            expect(internal.grid).toEqual(start);
            expect(internal.score).toBe(10);

            // A second undo has nothing to restore
            await processor.onData('u', context);
            expect(internal.grid).toEqual(start);
        });
    });

    describe('win and game over', () => {
        it('detects reaching 2048 and only continues after "C"', async () => {
            spawnFirstEmptyAsTwo();
            const { internal, context, processor } = await startWith([
                [1024, 1024, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ]);

            await processor.onData(LEFT, context);
            expect(internal.won).toBeTrue();
            expect(internal.grid[0][0]).toBe(2048);

            const before = internal.grid.map((r: number[]) => [...r]);
            await processor.onData(RIGHT, context);
            expect(internal.grid).toEqual(before); // ignored on win screen

            await processor.onData('c', context);
            expect(internal.keepPlaying).toBeTrue();
            await processor.onData(RIGHT, context);
            expect(internal.grid).not.toEqual(before);
        });

        it('ends the game when no moves remain and saves the high score', async () => {
            const { internal, context, processor, state$ } = await startWith(
                [
                    [0, 8, 16, 8],
                    [2, 4, 2, 8],
                    [4, 2, 4, 2],
                    [2, 4, 2, 4],
                ],
                100,
            );
            // Only one cell is empty after the move; spawn a 4 there.
            spyOn(Math, 'random').and.returnValues(0, 0.95);

            await processor.onData(LEFT, context);

            expect(internal.grid[0]).toEqual([8, 16, 8, 4]);
            expect(internal.gameOver).toBeTrue();
            expect(context.state.updateState).toHaveBeenCalled();
            expect(context.state.persist).toHaveBeenCalled();
            expect(state$.value['game2048HighScores'][0].score).toBe(100);
            expect(internal.bestScore).toBe(100);
        });

        it('restarts with "R" after game over and quits with Esc', async () => {
            spyOn(Math, 'random').and.returnValue(0);
            const { internal, context, processor } = await startWith([
                [2, 4, 2, 4],
                [4, 2, 4, 2],
                [2, 4, 2, 4],
                [4, 2, 4, 2],
            ]);
            internal.gameOver = true;

            await processor.onData('r', context);
            expect(internal.gameOver).toBeFalse();
            expect(internal.grid.flat().filter((v: number) => v !== 0).length).toBe(2);

            await processor.onData('\x1b', context);
            expect(context.exitFullScreenMode).toHaveBeenCalled();
        });
    });

    describe('high scores', () => {
        it('loads the best score from persisted state', async () => {
            const p = new Cli2048CommandProcessor();
            const { context } = createContext({
                game2048HighScores: [
                    { score: 50, date: 'a' },
                    { score: 300, date: 'b' },
                ],
            });
            await p.initialize(context);
            expect((p as any).bestScore).toBe(300);
        });

        it('"scores" reports when there are none, otherwise lists them sorted', async () => {
            const p = new Cli2048CommandProcessor();
            const empty = createContext();
            await p.initialize(empty.context);
            const scores = p.processors!.find((x) => x.command === 'scores')!;
            await scores.processCommand({} as any, empty.context);
            expect(empty.out.info[0]).toContain('No high scores yet');

            const p2 = new Cli2048CommandProcessor();
            const filled = createContext({
                game2048HighScores: [
                    { score: 50, date: 'd1' },
                    { score: 300, date: 'd2' },
                ],
            });
            await p2.initialize(filled.context);
            const scores2 = p2.processors!.find((x) => x.command === 'scores')!;
            await scores2.processCommand({} as any, filled.context);
            const rows = filled.out.lines.filter((l) => /^\s+\d+\./.test(l));
            expect(rows.length).toBe(2);
            expect(rows[0]).toContain('300');
            expect(rows[1]).toContain('50');
        });

        it('"reset" clears and persists the high scores', async () => {
            const p = new Cli2048CommandProcessor();
            const { context, out, state$ } = createContext({
                game2048HighScores: [{ score: 300, date: 'x' }],
            });
            await p.initialize(context);
            const reset = p.processors!.find((x) => x.command === 'reset')!;
            await reset.processCommand({} as any, context);

            expect(context.state.updateState).toHaveBeenCalledWith({
                game2048HighScores: [],
            });
            expect(context.state.persist).toHaveBeenCalled();
            expect(state$.value['game2048HighScores']).toEqual([]);
            expect((p as any).bestScore).toBe(0);
            expect(out.success.length).toBe(1);
        });
    });
});

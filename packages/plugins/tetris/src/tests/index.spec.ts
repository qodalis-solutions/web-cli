import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { CliTetrisCommandProcessor } from '../lib/processors/cli-tetris-command-processor';

// ── Fake context ────────────────────────────────────────────

interface FakeInterval {
    callback: () => void;
    delay: number;
    clear: jasmine.Spy;
    setDelay: jasmine.Spy;
}

function createContext(initialState: Record<string, any> = {}) {
    const state$ = new BehaviorSubject<Record<string, any>>({
        tetrisHighScores: [],
        ...initialState,
    });
    const out = { info: [] as string[], success: [] as string[], lines: [] as string[] };
    const intervals: FakeInterval[] = [];
    const context: any = {
        terminal: { cols: 100, rows: 30, write: jasmine.createSpy('write') },
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
        createInterval: jasmine
            .createSpy('createInterval')
            .and.callFake((callback: () => void, delay: number) => {
                const handle: FakeInterval = {
                    callback,
                    delay,
                    clear: jasmine.createSpy('clear'),
                    setDelay: jasmine.createSpy('setDelay'),
                };
                intervals.push(handle);
                return handle;
            }),
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
        },
    };
    return { context, out, state$, intervals };
}

async function start(initialState = {}) {
    // Math.random() === 0 always picks the first piece type, "I".
    spyOn(Math, 'random').and.returnValue(0);
    const p = new CliTetrisCommandProcessor();
    const env = createContext(initialState);
    await p.initialize(env.context);
    await p.processCommand({ command: 'tetris', args: {} } as any, env.context);
    const tick = () => env.intervals[env.intervals.length - 1].callback();
    return { p, internal: p as any, tick, ...env };
}

/** Fill a board row, leaving the given columns empty. */
function fillRow(internal: any, y: number, emptyCols: number[]) {
    for (let x = 0; x < 10; x++) {
        internal.board[y][x] = emptyCols.includes(x) ? null : 'X';
    }
}

const LEFT = '\x1b[D';
const RIGHT = '\x1b[C';
const DOWN = '\x1b[B';
const UP = '\x1b[A';

describe('CliTetrisCommandProcessor', () => {
    it('registers the command with metadata and sub-commands', () => {
        const p = new CliTetrisCommandProcessor();
        expect(p.command).toBe('tetris');
        expect(p.metadata?.module).toBe('games');
        expect(p.stateConfiguration?.initialState).toEqual({ tetrisHighScores: [] });
        expect(p.processors!.map((x) => x.command)).toEqual(['scores', 'reset']);
    });

    it('starts with an empty 10x20 board, a spawned piece and an 800ms loop', async () => {
        const { internal, context, intervals } = await start();
        expect(context.enterFullScreenMode).toHaveBeenCalled();
        expect(internal.board.length).toBe(20);
        expect(internal.board.every((row: any[]) => row.length === 10 && row.every((c) => c === null))).toBeTrue();
        expect(internal.currentPiece).toEqual({ type: 'I', rotation: 0, x: 3, y: 0 });
        expect(intervals[0].delay).toBe(800);
    });

    it('moves left and right but not through the walls', async () => {
        const { p, internal, context } = await start();
        for (let i = 0; i < 5; i++) await p.onData(LEFT, context);
        expect(internal.currentPiece.x).toBe(0);
        for (let i = 0; i < 10; i++) await p.onData(RIGHT, context);
        // The horizontal I spans x..x+3
        expect(internal.currentPiece.x).toBe(6);
    });

    it('rotates through all four states and back', async () => {
        const { p, internal, context } = await start();
        internal.currentPiece = { type: 'T', rotation: 0, x: 3, y: 5 };
        const seen: number[] = [];
        for (let i = 0; i < 4; i++) {
            await p.onData(UP, context);
            seen.push(internal.currentPiece.rotation);
        }
        expect(seen).toEqual([1, 2, 3, 0]);
        expect(internal.currentPiece.x).toBe(3);
    });

    it('wall-kicks a rotation that would leave the board', async () => {
        const { p, internal, context } = await start();
        // Vertical I hugging the left wall (rotation 3 uses column x+1).
        internal.currentPiece = { type: 'I', rotation: 3, x: -1, y: 5 };
        await p.onData('w', context);
        expect(internal.currentPiece.rotation).toBe(0);
        expect(internal.currentPiece.x).toBe(0);
    });

    it('awards 1 point per soft-drop row and 2 per hard-drop row, then locks the piece', async () => {
        const { p, internal, context } = await start();
        await p.onData(DOWN, context);
        expect(internal.score).toBe(1);
        expect(internal.currentPiece.y).toBe(1);

        await p.onData(' ', context);
        // from y=1 the I (row offset 1) falls to y=18: 17 rows
        expect(internal.score).toBe(1 + 17 * 2);
        expect(internal.board[19].slice(3, 7).every((c: any) => c !== null)).toBeTrue();
        expect(internal.currentPiece).toEqual({ type: 'I', rotation: 0, x: 3, y: 0 });
    });

    it('clears a completed line and shifts rows above it down', async () => {
        const { p, internal, context } = await start();
        fillRow(internal, 19, [3, 4, 5, 6]);
        internal.board[18][0] = 'M';

        // The I falls into the gap in row 19, completing it.
        await p.onData(' ', context);

        expect(internal.linesCleared).toBe(1);
        // Row 18 (with its marker) moved down into row 19.
        expect(internal.board[19]).toEqual(['M', null, null, null, null, null, null, null, null, null]);
        expect(internal.board[18].every((c: any) => c === null)).toBeTrue();
        expect(internal.score).toBe(18 * 2 + 100);
    });

    it('scores a four-line clear as 800 x level', async () => {
        const { p, internal, context } = await start();
        for (let y = 16; y < 20; y++) fillRow(internal, y, [0]);
        internal.currentPiece = { type: 'I', rotation: 3, x: -1, y: 0 };

        await p.onData(' ', context);

        expect(internal.linesCleared).toBe(4);
        expect(internal.score).toBe(16 * 2 + 800);
        expect(internal.board.every((row: any[]) => row.every((c) => c === null))).toBeTrue();
    });

    it('levels up every 10 lines and speeds up the loop', async () => {
        const { p, internal, context, intervals } = await start();
        internal.linesCleared = 9;
        fillRow(internal, 19, [3, 4, 5, 6]);

        await p.onData(' ', context);

        expect(internal.level).toBe(2);
        expect(internal.currentSpeed).toBe(730);
        expect(intervals[0].setDelay).toHaveBeenCalledWith(730);
    });

    it('gravity ticks move the piece down and lock it when it lands', async () => {
        const { internal, tick } = await start();
        tick();
        expect(internal.currentPiece.y).toBe(1);

        internal.currentPiece.y = 18;
        tick();
        expect(internal.board[19][3]).not.toBeNull();
        expect(internal.currentPiece.y).toBe(0);
    });

    it('ends the game when a new piece cannot spawn and saves the score', async () => {
        const { internal, tick, intervals, state$, context } = await start();
        // Block the spawn row (I spawns on row 1, columns 3..6).
        fillRow(internal, 1, [0]);
        internal.currentPiece = { type: 'O', rotation: 0, x: 0, y: 2 };
        // Make the O unable to fall so the next tick locks it (row is not
        // complete, so it is not cleared).
        fillRow(internal, 4, [9]);
        internal.score = 250;

        tick();

        expect(internal.gameOver).toBeTrue();
        expect(intervals[0].clear).toHaveBeenCalled();
        expect(context.state.persist).toHaveBeenCalled();
        expect(state$.value['tetrisHighScores'][0]).toEqual(
            jasmine.objectContaining({ score: 250, level: 1, lines: 0 }),
        );
    });

    it('ignores movement and gravity while paused', async () => {
        const { p, internal, tick, context } = await start();
        await p.onData('p', context);
        await p.onData(LEFT, context);
        await p.onData(' ', context);
        tick();
        expect(internal.currentPiece).toEqual({ type: 'I', rotation: 0, x: 3, y: 0 });

        await p.onData('P', context);
        await p.onData(LEFT, context);
        expect(internal.currentPiece.x).toBe(2);
    });

    it('restarts with "R" after game over and quits with Esc', async () => {
        const { p, internal, context, intervals } = await start();
        internal.gameOver = true;
        internal.score = 99;

        await p.onData('r', context);
        expect(internal.gameOver).toBeFalse();
        expect(internal.score).toBe(0);
        expect(internal.board.every((row: any[]) => row.every((c) => c === null))).toBeTrue();
        expect(intervals.length).toBe(1); // timer still active, reused

        await p.onData('\x1b', context);
        expect(context.exitFullScreenMode).toHaveBeenCalled();
    });

    it('"scores" reports none, or lists scores sorted', async () => {
        const p = new CliTetrisCommandProcessor();
        const empty = createContext();
        await p.initialize(empty.context);
        await p.processors!.find((x) => x.command === 'scores')!.processCommand({} as any, empty.context);
        expect(empty.out.info[0]).toContain('No high scores yet');

        const p2 = new CliTetrisCommandProcessor();
        const filled = createContext({
            tetrisHighScores: [
                { score: 100, level: 1, lines: 1, date: 'a' },
                { score: 5000, level: 3, lines: 25, date: 'b' },
            ],
        });
        await p2.initialize(filled.context);
        await p2.processors!.find((x) => x.command === 'scores')!.processCommand({} as any, filled.context);
        const rows = filled.out.lines.filter((l) => /^\s+\d+\./.test(l));
        expect(rows.length).toBe(2);
        expect(rows[0]).toContain('5000');
        expect(rows[0]).toContain('Lv3');
    });

    it('"reset" clears and persists high scores', async () => {
        const p = new CliTetrisCommandProcessor();
        const { context, state$, out } = createContext({
            tetrisHighScores: [{ score: 100, level: 1, lines: 1, date: 'a' }],
        });
        await p.initialize(context);
        await p.processors!.find((x) => x.command === 'reset')!.processCommand({} as any, context);
        expect(state$.value['tetrisHighScores']).toEqual([]);
        expect(context.state.persist).toHaveBeenCalled();
        expect(out.success.length).toBe(1);
    });
});

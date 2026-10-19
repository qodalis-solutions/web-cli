import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { CliSnakeCommandProcessor } from '../lib/processors/cli-snake-command-processor';

// ── Fake context ────────────────────────────────────────────

interface FakeInterval {
    callback: () => void;
    delay: number;
    clear: jasmine.Spy;
    setDelay: jasmine.Spy;
}

function createContext(initialState: Record<string, any> = {}) {
    const state$ = new BehaviorSubject<Record<string, any>>({
        snakeHighScores: [],
        ...initialState,
    });
    const out = { info: [] as string[], success: [] as string[], lines: [] as string[] };
    const intervals: FakeInterval[] = [];
    const context: any = {
        // 84x30 terminal -> 40x25 grid
        terminal: { cols: 84, rows: 30, write: jasmine.createSpy('write') },
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
    // Food spawns at (0,0) unless a test moves it.
    spyOn(Math, 'random').and.returnValue(0);
    const p = new CliSnakeCommandProcessor();
    const env = createContext(initialState);
    await p.initialize(env.context);
    await p.processCommand({ command: 'snake', args: {} } as any, env.context);
    const tick = () => env.intervals[env.intervals.length - 1].callback();
    return { p, internal: p as any, tick, ...env };
}

const UP = '\x1b[A';
const DOWN = '\x1b[B';
const LEFT = '\x1b[D';

describe('CliSnakeCommandProcessor', () => {
    it('registers the command with alias, metadata and sub-commands', () => {
        const p = new CliSnakeCommandProcessor();
        expect(p.command).toBe('snake');
        expect(p.aliases).toEqual(['snek']);
        expect(p.metadata?.module).toBe('games');
        expect(p.stateConfiguration?.initialState).toEqual({ snakeHighScores: [] });
        expect(p.processors!.map((x) => x.command)).toEqual(['scores', 'reset']);
    });

    it('starts a full-screen game with a 3-segment snake heading right', async () => {
        const { internal, context, intervals } = await start();
        expect(context.enterFullScreenMode).toHaveBeenCalled();
        expect(intervals.length).toBe(1);
        expect(intervals[0].delay).toBe(150);
        expect([internal.gridWidth, internal.gridHeight]).toEqual([40, 25]);
        expect(internal.snake).toEqual([
            { x: 20, y: 12 },
            { x: 19, y: 12 },
            { x: 18, y: 12 },
        ]);
        expect(internal.food).toEqual({ x: 0, y: 0 });
    });

    it('moves one cell per tick without growing', async () => {
        const { internal, tick } = await start();
        tick();
        expect(internal.snake).toEqual([
            { x: 21, y: 12 },
            { x: 20, y: 12 },
            { x: 19, y: 12 },
        ]);
    });

    it('turns on the next tick and ignores direct reversal', async () => {
        const { p, internal, tick, context } = await start();

        await p.onData(LEFT, context); // reversal while moving right: ignored
        tick();
        expect(internal.snake[0]).toEqual({ x: 21, y: 12 });

        await p.onData(UP, context);
        tick();
        expect(internal.snake[0]).toEqual({ x: 21, y: 11 });

        await p.onData(DOWN, context); // reversal while moving up: ignored
        await p.onData('a', context); // WASD works too
        tick();
        expect(internal.snake[0]).toEqual({ x: 20, y: 11 });
    });

    it('grows, scores and speeds up when eating food, respawning food off the snake', async () => {
        const { internal, tick, intervals } = await start();
        internal.food = { x: 21, y: 12 };

        tick();

        expect(internal.snake.length).toBe(4);
        expect(internal.score).toBe(10);
        expect(intervals[0].setDelay).toHaveBeenCalledWith(147);
        const onSnake = internal.snake.some(
            (s: any) => s.x === internal.food.x && s.y === internal.food.y,
        );
        expect(onSnake).toBeFalse();
    });

    it('ends the game on wall collision and saves a positive score', async () => {
        const { internal, tick, intervals, state$, context } = await start();
        internal.snake = [
            { x: 39, y: 5 },
            { x: 38, y: 5 },
            { x: 37, y: 5 },
        ];
        internal.score = 30;

        tick();

        expect(internal.gameOver).toBeTrue();
        expect(intervals[0].clear).toHaveBeenCalled();
        expect(context.state.persist).toHaveBeenCalled();
        expect(state$.value['snakeHighScores'].map((s: any) => s.score)).toEqual([30]);
    });

    it('ends the game on self collision', async () => {
        const { p, internal, tick, context } = await start();
        // A hook shape: moving up from (5,5) runs into (5,4).
        internal.snake = [
            { x: 5, y: 5 },
            { x: 6, y: 5 },
            { x: 6, y: 4 },
            { x: 5, y: 4 },
            { x: 4, y: 4 },
        ];
        internal.direction = 3; // Right
        await p.onData(UP, context);

        tick();

        expect(internal.gameOver).toBeTrue();
        // No score, so nothing is persisted
        expect(context.state.updateState).not.toHaveBeenCalled();
    });

    it('does not advance while paused', async () => {
        const { p, internal, tick, context } = await start();
        await p.onData(' ', context);
        expect(internal.paused).toBeTrue();
        tick();
        expect(internal.snake[0]).toEqual({ x: 20, y: 12 });

        await p.onData(' ', context);
        tick();
        expect(internal.snake[0]).toEqual({ x: 21, y: 12 });
    });

    it('restarts with "R" after game over and quits with Esc', async () => {
        const { p, internal, context, intervals } = await start();
        internal.snake = [{ x: 39, y: 0 }];
        intervals[0].callback();
        expect(internal.gameOver).toBeTrue();

        await p.onData('r', context);
        expect(internal.gameOver).toBeFalse();
        expect(internal.snake.length).toBe(3);
        expect(internal.score).toBe(0);
        expect(intervals.length).toBe(2);

        await p.onData('\x1b', context);
        expect(context.exitFullScreenMode).toHaveBeenCalled();
    });

    it('"scores" reports none, or lists the top scores sorted', async () => {
        const p = new CliSnakeCommandProcessor();
        const empty = createContext();
        await p.initialize(empty.context);
        const scores = p.processors!.find((x) => x.command === 'scores')!;
        await scores.processCommand({} as any, empty.context);
        expect(empty.out.info[0]).toContain('No high scores yet');

        const p2 = new CliSnakeCommandProcessor();
        const filled = createContext({
            snakeHighScores: [
                { score: 20, date: 'a' },
                { score: 90, date: 'b' },
            ],
        });
        await p2.initialize(filled.context);
        await p2.processors!.find((x) => x.command === 'scores')!.processCommand({} as any, filled.context);
        const rows = filled.out.lines.filter((l) => /^\s+\d+\./.test(l));
        expect(rows.length).toBe(2);
        expect(rows[0]).toContain('90');
    });

    it('"reset" clears and persists high scores', async () => {
        const p = new CliSnakeCommandProcessor();
        const { context, state$, out } = createContext({
            snakeHighScores: [{ score: 20, date: 'a' }],
        });
        await p.initialize(context);
        await p.processors!.find((x) => x.command === 'reset')!.processCommand({} as any, context);
        expect(state$.value['snakeHighScores']).toEqual([]);
        expect(context.state.persist).toHaveBeenCalled();
        expect(out.success.length).toBe(1);
    });
});

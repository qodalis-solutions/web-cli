import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { CliWordleCommandProcessor } from '../lib/processors/cli-wordle-command-processor';
import { WORD_LIST } from '../lib/words';

// ── Fake context ────────────────────────────────────────────

const EMPTY_STATS = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: [0, 0, 0, 0, 0, 0],
};

function createContext(initialState: Record<string, any> = {}) {
    const state$ = new BehaviorSubject<Record<string, any>>({
        wordleStats: { ...EMPTY_STATS, guessDistribution: [0, 0, 0, 0, 0, 0] },
        ...initialState,
    });
    const out = { success: [] as string[], lines: [] as string[] };
    const context: any = {
        terminal: { cols: 80, rows: 50, write: jasmine.createSpy('write') },
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
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
    return { context, out, state$ };
}

/** Start a game whose answer is `target` (must be in WORD_LIST). */
async function startWith(target: string, initialState = {}) {
    const index = WORD_LIST.indexOf(target);
    if (index < 0) throw new Error(`${target} is not in WORD_LIST`);
    spyOn(Math, 'random').and.returnValue((index + 0.5) / WORD_LIST.length);
    const p = new CliWordleCommandProcessor();
    const env = createContext(initialState);
    await p.initialize(env.context);
    await p.processCommand({ command: 'wordle', args: {} } as any, env.context);
    return { p, internal: p as any, ...env };
}

async function type(p: CliWordleCommandProcessor, context: any, text: string) {
    for (const ch of text) await p.onData(ch, context);
}

async function guess(p: CliWordleCommandProcessor, context: any, word: string) {
    await type(p, context, word);
    await p.onData('\r', context);
}

describe('CliWordleCommandProcessor', () => {
    it('registers the command with metadata, initial stats and sub-commands', () => {
        const p = new CliWordleCommandProcessor();
        expect(p.command).toBe('wordle');
        expect(p.metadata?.module).toBe('games');
        expect(p.stateConfiguration?.initialState).toEqual({ wordleStats: EMPTY_STATS });
        expect(p.processors!.map((x) => x.command)).toEqual(['stats', 'reset']);
    });

    it('only uses five-letter lowercase words', () => {
        expect(WORD_LIST.length).toBeGreaterThan(100);
        expect(WORD_LIST.every((w) => /^[a-z]{5}$/.test(w))).toBeTrue();
    });

    it('picks the target word from the word list', async () => {
        const { internal, context } = await startWith('crane');
        expect(internal.targetWord).toBe('crane');
        expect(context.enterFullScreenMode).toHaveBeenCalled();
    });

    describe('guess evaluation', () => {
        it('marks correct, present and absent letters', async () => {
            const { internal } = await startWith('apple');
            // a=correct, l=present, second l=absent (only one l), e=present, y=absent
            expect(internal.evaluateGuess('alley')).toEqual([
                'correct',
                'present',
                'absent',
                'present',
                'absent',
            ]);
        });

        it('gives the correct position priority over an earlier duplicate', async () => {
            const { internal } = await startWith('brain');
            // the r in position 1 is correct, so the second r gets nothing;
            // the first a is present, the second a is absent
            expect(internal.evaluateGuess('array')).toEqual([
                'present',
                'correct',
                'absent',
                'absent',
                'absent',
            ]);
        });

        it('handles repeated letters that appear twice in the answer', async () => {
            const { internal } = await startWith('class');
            expect(internal.evaluateGuess('bless')).toEqual([
                'absent',
                'correct',
                'absent',
                'correct',
                'correct',
            ]);
            expect(internal.evaluateGuess('class')).toEqual(new Array(5).fill('correct'));
        });
    });

    it('collects up to five lowercase letters, supports backspace and ignores other keys', async () => {
        const { p, internal, context } = await startWith('crane');
        await type(p, context, 'ABOUTX');
        expect(internal.currentInput).toBe('about');

        await p.onData('\x7f', context);
        await p.onData('1', context);
        await p.onData('\x1b[A', context);
        expect(internal.currentInput).toBe('abou');

        // Enter with fewer than five letters does nothing
        await p.onData('\r', context);
        expect(internal.guesses).toEqual([]);
    });

    it('rejects words that are not in the list without using a guess', async () => {
        const { p, internal, context } = await startWith('crane');
        await guess(p, context, 'zzzzz');
        expect(internal.guesses).toEqual([]);
        expect(internal.invalidGuessMessage).toBe('Not in word list!');
        expect(internal.currentInput).toBe('zzzzz');
    });

    it('tracks keyboard letter status with green > yellow > gray precedence', async () => {
        const { p, internal, context } = await startWith('apple');
        await guess(p, context, 'alley');
        expect(internal.keyboardStatus.get('L')).toBe('present');
        expect(internal.keyboardStatus.get('Y')).toBe('absent');
        expect(internal.keyboardStatus.get('A')).toBe('correct');

        // 'about': a still correct, b/o/u/t absent
        await guess(p, context, 'about');
        expect(internal.keyboardStatus.get('A')).toBe('correct');
        expect(internal.keyboardStatus.get('B')).toBe('absent');
    });

    it('wins on the correct guess and records the stats', async () => {
        const { p, internal, context, state$ } = await startWith('apple');
        await guess(p, context, 'alley');
        await guess(p, context, 'apple');

        expect(internal.gameOver).toBeTrue();
        expect(internal.gameWon).toBeTrue();
        expect(context.state.persist).toHaveBeenCalled();
        expect(state$.value['wordleStats']).toEqual({
            gamesPlayed: 1,
            gamesWon: 1,
            currentStreak: 1,
            maxStreak: 1,
            guessDistribution: [0, 1, 0, 0, 0, 0],
        });
    });

    it('loses after six wrong guesses and resets the streak', async () => {
        const { p, internal, context, state$ } = await startWith('apple', {
            wordleStats: {
                gamesPlayed: 3,
                gamesWon: 3,
                currentStreak: 3,
                maxStreak: 3,
                guessDistribution: [0, 0, 3, 0, 0, 0],
            },
        });
        for (const w of ['about', 'above', 'crane', 'brain', 'chair', 'class']) {
            await guess(p, context, w);
        }

        expect(internal.gameOver).toBeTrue();
        expect(internal.gameWon).toBeFalse();
        expect(state$.value['wordleStats']).toEqual({
            gamesPlayed: 4,
            gamesWon: 3,
            currentStreak: 0,
            maxStreak: 3,
            guessDistribution: [0, 0, 3, 0, 0, 0],
        });
    });

    it('treats "q" as a letter during play, Esc quits, and "R" restarts after game over', async () => {
        const { p, internal, context } = await startWith('apple');
        await p.onData('q', context);
        expect(internal.currentInput).toBe('q');
        expect(context.exitFullScreenMode).not.toHaveBeenCalled();
        await p.onData('\x7f', context);

        await guess(p, context, 'apple');
        expect(internal.gameOver).toBeTrue();
        await p.onData('r', context);
        expect(internal.gameOver).toBeFalse();
        expect(internal.guesses).toEqual([]);

        await p.onData('\x1b', context);
        expect(context.exitFullScreenMode).toHaveBeenCalled();
    });

    it('"stats" prints games played, win percentage and streaks', async () => {
        const p = new CliWordleCommandProcessor();
        const { context, out } = createContext({
            wordleStats: {
                gamesPlayed: 4,
                gamesWon: 3,
                currentStreak: 2,
                maxStreak: 5,
                guessDistribution: [0, 1, 2, 0, 0, 0],
            },
        });
        await p.initialize(context);
        await p.processors!.find((x) => x.command === 'stats')!.processCommand({} as any, context);
        const text = out.lines.join('\n');
        expect(text).toMatch(/Games Played:\s+4/);
        expect(text).toMatch(/Win %:\s+75%/);
        expect(text).toMatch(/Current Streak:\s+2/);
        expect(text).toMatch(/Max Streak:\s+5/);
        expect(text).toMatch(/3: █+ 2/);
    });

    it('"reset" clears and persists the stats', async () => {
        const p = new CliWordleCommandProcessor();
        const { context, out, state$ } = createContext({
            wordleStats: { ...EMPTY_STATS, gamesPlayed: 9, gamesWon: 2 },
        });
        await p.initialize(context);
        await p.processors!.find((x) => x.command === 'reset')!.processCommand({} as any, context);
        expect(state$.value['wordleStats']).toEqual(EMPTY_STATS);
        expect(context.state.persist).toHaveBeenCalled();
        expect(out.success.length).toBe(1);
    });
});

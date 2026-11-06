import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { DefaultThemes } from '@qodalis/cli-core';
import { CliThemeCommandProcessor } from '../lib/processors/theme/cli-theme-command-processor';
import {
    CLI_TERMINAL_THEME_EVENT,
    applyUserTerminalTheme,
    resetTerminalTheme,
    setHostTerminalTheme,
} from '../lib/processors/theme/terminal-theme';

/** A terminal inside a `.terminal-container`, in the given theme. */
function terminal(theme: object) {
    const container = document.createElement('div');
    container.className = 'terminal-container';
    const element = document.createElement('div');
    container.appendChild(element);
    return { options: { theme }, element, container } as any;
}

/** A terminal and a theme store holding `saved` (a `theme apply`). */
function context(options: object, saved: Record<string, any> = { selectedTheme: 'dracula' }) {
    const state$ = new BehaviorSubject<Record<string, any>>(saved);
    return {
        options,
        terminal: terminal(DefaultThemes.light),
        state: {
            getState: () => state$.value,
            select: (fn: (s: Record<string, any>) => unknown) =>
                state$.pipe(map(fn)),
            updateState: (patch: object) =>
                state$.next({ ...state$.value, ...patch }),
            reset: () => state$.next({}),
            persist: async () => undefined,
        },
        writer: { writeSuccess: () => undefined },
        state$,
    } as any;
}

function subcommand(processor: CliThemeCommandProcessor, name: string) {
    return processor.processors!.find((p) => p.command === name)!;
}

describe('theme command and the host theme', () => {
    it('restores the saved theme when the host sets none', async () => {
        const ctx = context({});
        await new CliThemeCommandProcessor().initialize(ctx);
        expect(ctx.terminal.options.theme).toEqual(DefaultThemes.dracula);
    });

    it("restores the user's saved theme over the host's, also when the store loads later", async () => {
        const ctx = context({ theme: 'light' });
        await new CliThemeCommandProcessor().initialize(ctx);
        expect(ctx.terminal.options.theme).toEqual(DefaultThemes.dracula);
        ctx.state$.next({ selectedTheme: 'nord' });
        expect(ctx.terminal.options.theme).toEqual(DefaultThemes.nord);
    });

    it("keeps the host's theme when nothing is saved", async () => {
        const ctx = context({ theme: 'light' }, {});
        await new CliThemeCommandProcessor().initialize(ctx);
        expect(ctx.terminal.options.theme).toBe(DefaultThemes.light);
    });

    it("applies a theme and returns to the host's on reset", async () => {
        const ctx = context({ theme: 'light' }, {});
        const processor = new CliThemeCommandProcessor();
        await processor.initialize(ctx);

        await subcommand(processor, 'apply').processCommand!({ value: 'dracula' } as any, ctx);
        expect(ctx.terminal.options.theme).toEqual(DefaultThemes.dracula);
        expect(ctx.terminal.container.style.background).not.toBe('');

        await subcommand(processor, 'reset').processCommand!({} as any, ctx);
        expect(ctx.terminal.options.theme).toEqual(DefaultThemes.light);
    });

    it('keeps each terminal its own default (the processor is shared)', async () => {
        const processor = new CliThemeCommandProcessor();
        const light = context({ theme: 'light' }, {});
        const dark = context({}, {});
        dark.terminal.options.theme = DefaultThemes.default;
        await processor.initialize(light);
        await processor.initialize(dark);

        await subcommand(processor, 'reset').processCommand!({} as any, light);
        expect(light.terminal.options.theme).toEqual(DefaultThemes.light);
    });

    it('restyles only its own terminal', async () => {
        const other = terminal(DefaultThemes.light);
        document.body.appendChild(other.container);
        const ctx = context({}, {});
        const processor = new CliThemeCommandProcessor();
        await processor.initialize(ctx);
        await subcommand(processor, 'apply').processCommand!({ value: 'nord' } as any, ctx);
        expect(other.container.style.background).toBe('');
        other.container.remove();
    });
});

describe('terminal theme record', () => {
    it("doesn't let a host theme replace the user's theme", () => {
        const t = terminal(DefaultThemes.default);
        applyUserTerminalTheme(t, DefaultThemes.dracula);
        setHostTerminalTheme(t, DefaultThemes.light);
        expect(t.options.theme).toBe(DefaultThemes.dracula);

        resetTerminalTheme(t);
        expect(t.options.theme).toEqual(DefaultThemes.light);

        setHostTerminalTheme(t, DefaultThemes.default);
        expect(t.options.theme).toBe(DefaultThemes.default);
    });

    it('announces the new theme on the container', () => {
        const t = terminal(DefaultThemes.default);
        const seen: unknown[] = [];
        t.container.addEventListener(CLI_TERMINAL_THEME_EVENT, (e: Event) =>
            seen.push((e as CustomEvent).detail),
        );
        applyUserTerminalTheme(t, DefaultThemes.nord);
        expect(seen).toEqual([DefaultThemes.nord]);
    });
});

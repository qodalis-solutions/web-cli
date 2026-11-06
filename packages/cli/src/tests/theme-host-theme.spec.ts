import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { DefaultThemes } from '@qodalis/cli-core';
import { CliThemeCommandProcessor } from '../lib/processors/theme/cli-theme-command-processor';

/** A terminal and a theme store holding a saved `theme apply dracula`. */
function context(options: object) {
    const state$ = new BehaviorSubject<Record<string, any>>({
        selectedTheme: 'dracula',
    });
    return {
        options,
        terminal: { options: { theme: DefaultThemes.light } },
        state: {
            getState: () => state$.value,
            select: (fn: (s: Record<string, any>) => unknown) =>
                state$.pipe(map(fn)),
            updateState: (patch: object) =>
                state$.next({ ...state$.value, ...patch }),
        },
        state$,
    } as any;
}

describe('theme command and the host theme', () => {
    it('restores the saved theme when the host sets none', async () => {
        const ctx = context({});
        await new CliThemeCommandProcessor().initialize(ctx);
        expect(ctx.terminal.options.theme).toEqual(DefaultThemes.dracula);
    });

    it("keeps the host's theme over the saved one, also when the store loads later", async () => {
        const ctx = context({ theme: 'light' });
        await new CliThemeCommandProcessor().initialize(ctx);
        expect(ctx.terminal.options.theme).toBe(DefaultThemes.light);
        ctx.state$.next({ selectedTheme: 'nord' });
        expect(ctx.terminal.options.theme).toBe(DefaultThemes.light);
    });
});

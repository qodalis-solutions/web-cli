import { CliCommandProcessorRegistry } from '../lib/registry';
import { CliServerManager } from '../lib/server/cli-server-manager';
import {
    fitGreeting,
    welcomeModule,
    wrapWelcomeLine,
} from '../lib/services/cli-welcome-message';
import { CliStateStoreManager_TOKEN } from '../lib/tokens';

describe('welcome on a narrow terminal', () => {
    it('wraps text lines at words, leaving lines that fit alone', () => {
        const line = '(c) 2026 Qodalis Solutions. All rights reserved.';
        expect(wrapWelcomeLine(line, 80)).toEqual([line]);
        const wrapped = wrapWelcomeLine(line, 30);
        expect(wrapped).toEqual([
            '(c) 2026 Qodalis Solutions.',
            'All rights reserved.',
        ]);
        wrapped.forEach((part) => expect(part.length).toBeLessThan(30));
    });

    it('measures without color codes', () => {
        const colored =
            "💡 Type \x1b[36m'help'\x1b[0m to see available commands";
        expect(wrapWelcomeLine(colored, 50)).toEqual([colored]);
        expect(wrapWelcomeLine(colored, 25).length).toBe(2);
    });
});

describe('fitGreeting', () => {
    const greeting = '☀️ Good morning! Wishing you a productive day ahead!';

    it('keeps a greeting that fits, cuts a longer one at a word, drops one that is too short to read', () => {
        expect(fitGreeting(greeting, 80)).toBe(greeting);
        expect(fitGreeting(greeting, 26)).toBe('☀️ Good morning! Wishing');
        expect(fitGreeting(greeting, 10)).toBeNull();
    });
});

describe('connecting to a server that needs a sign-in', () => {
    let fetchSpy: jasmine.Spy;

    beforeEach(() => {
        fetchSpy = spyOn(window, 'fetch').and.callFake(((
            input: RequestInfo | URL,
        ) => {
            const url = String(input);
            if (url.endsWith('/api/qcli/versions')) {
                return Promise.resolve(
                    new Response(
                        JSON.stringify({
                            supportedVersions: [1],
                            preferredVersion: 1,
                        }),
                        { status: 200 },
                    ),
                );
            }
            if (url.endsWith('/commands')) {
                return Promise.resolve(
                    new Response('{"error":"Unauthorized"}', { status: 401 }),
                );
            }
            return Promise.resolve(new Response('', { status: 404 }));
        }) as typeof fetch);
    });

    it('does not report it as unreachable: its commands load once signed in', async () => {
        const manager = new CliServerManager(new CliCommandProcessorRegistry());
        const warnings: string[] = [];
        const infos: string[] = [];

        await manager.connectAll(
            [{ name: 'ratebell', url: 'http://localhost:5173' }],
            { warn: (m) => warnings.push(m), info: (m) => infos.push(m) },
        );

        expect(fetchSpy).toHaveBeenCalled();
        expect(warnings).toEqual([]);
        expect(infos.join(' ')).toContain("Server 'ratebell' needs a sign-in");
        expect(manager.connections.get('ratebell')!.needsSignIn).toBeTrue();
    });
});

describe('welcome shown once', () => {
    const key = 'cliWelcomeMessageLastDisplayed';
    let saved: string | null;

    beforeEach(() => (saved = localStorage.getItem(key)));
    afterEach(() =>
        saved === null
            ? localStorage.removeItem(key)
            : localStorage.setItem(key, saved),
    );

    const boot = async (stored: string) => {
        const store = {
            initialize: async () => {},
            getState: () => ({ system: { welcomeMessage: stored } }),
        };
        const context: any = {
            services: {
                get: (token: string) =>
                    token === CliStateStoreManager_TOKEN
                        ? { getStateStore: () => store }
                        : undefined,
            },
            terminal: {
                write: jasmine.createSpy('write'),
                writeln: jasmine.createSpy('writeln'),
            },
            showPrompt: jasmine.createSpy('showPrompt'),
        };
        await welcomeModule.configure({ show: 'once' }).onAfterBoot!(context);
        return context;
    };

    it("keeps the host's 'once' over configure's stored default", async () => {
        localStorage.setItem(key, new Date().toISOString());
        const context = await boot('always');
        expect(context.terminal.write).not.toHaveBeenCalled();
        expect(context.showPrompt).toHaveBeenCalled();
    });

    it("lets a value set with configure win over the host's option", async () => {
        localStorage.setItem(key, new Date().toISOString());
        const context = await boot('never');
        expect(context.terminal.write).not.toHaveBeenCalled();
        localStorage.removeItem(key);
        expect((await boot('never')).terminal.write).not.toHaveBeenCalled();
    });
});

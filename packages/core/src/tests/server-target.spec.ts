import { cliDefaultServer } from '../lib/utils/server-target';
import { ICliServerManager_TOKEN } from '../lib/interfaces/services';

describe('cliDefaultServer', () => {
    const servers = [
        { name: 'dotnet', url: 'http://d' },
        { name: 'node', url: 'http://n' },
    ];
    const ctx = (preferred?: string | null, withManager = true) => ({
        options: { servers } as any,
        services: {
            get: (token: string) =>
                token === ICliServerManager_TOKEN && withManager
                    ? { reconnect: async () => ({ success: true, commandCount: 0 }), preferredServer: () => preferred ?? null }
                    : undefined,
        } as any,
    });

    it("uses the manager's preferred (default or connected) server", () => {
        expect(cliDefaultServer(ctx('node'))?.name).toBe('node');
    });

    it('falls back to the first configured server', () => {
        expect(cliDefaultServer(ctx(null))?.name).toBe('dotnet');
        expect(cliDefaultServer(ctx(undefined, false))?.name).toBe('dotnet');
    });

    it('returns undefined when no servers are configured', () => {
        expect(cliDefaultServer({ options: {} as any, services: { get: () => undefined } as any })).toBeUndefined();
    });
});

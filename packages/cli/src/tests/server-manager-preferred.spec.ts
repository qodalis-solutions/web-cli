import { CliServerManager } from '../lib/server/cli-server-manager';

describe('CliServerManager.preferredServer', () => {
    function manager(state: Record<string, boolean>) {
        const m = new CliServerManager({} as any);
        for (const [name, connected] of Object.entries(state)) {
            m.connections.set(name, { connected } as any);
        }
        return m;
    }

    it('is the first connected server when no default is set', () => {
        expect(manager({ dotnet: false, node: true, python: true }).preferredServer()).toBe('node');
    });

    it('prefers the default server while it is connected', () => {
        const m = manager({ node: true, python: true });
        (m as any)._defaultServer = 'python';
        expect(m.preferredServer()).toBe('python');
        (m.connections.get('python') as any).connected = false;
        expect(m.preferredServer()).toBe('node');
    });

    it('is null when nothing is connected', () => {
        expect(manager({ dotnet: false }).preferredServer()).toBeNull();
    });
});

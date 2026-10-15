import { CliTerminalLineRenderer } from '../lib/input/cli-terminal-line-renderer';

describe('prompt user label', () => {
    const renderer = new CliTerminalLineRenderer({} as any, { wrapInColor: (t: string) => t } as any);
    const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
    const path = () => '/home';

    it('shows the signed-in user in green', () => {
        const p = renderer.getPromptString({ userName: 'alice', pathProvider: path });
        expect(plain(p)).toBe('alice:/home$ ');
        expect(p).toContain('\x1b[32malice');
    });

    it('shows a dimmed anonymous label while signed out', () => {
        const p = renderer.getPromptString({ anonymousName: 'anonymous', pathProvider: path });
        expect(plain(p)).toBe('anonymous:/home$ ');
        expect(p).toContain('\x1b[90manonymous');
    });

    it('shows no label without an auth module or when hidden', () => {
        expect(plain(renderer.getPromptString({ pathProvider: path }))).toBe('/home$ ');
        expect(plain(renderer.getPromptString({ anonymousName: 'anonymous', hideUserName: true, pathProvider: path }))).toBe('/home$ ');
    });
});

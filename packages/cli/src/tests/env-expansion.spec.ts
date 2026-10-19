import { ICliEnvironment_TOKEN } from '../lib/services/cli-environment';
import { expandEnvironmentVars } from '../lib/executor/cli-script-executor';

describe('expandEnvironmentVars', () => {
    const vars: Record<string, string> = { HOME: '/home/ana', USER: 'ana' };
    const context: any = {
        services: {
            get: (token: any) =>
                token === ICliEnvironment_TOKEN ? { get: (name: string) => vars[name] } : undefined,
        },
    };
    const expand = (cmd: string, code?: number) => expandEnvironmentVars(cmd, context, code);

    it('expands outside quotes and inside double quotes', () => {
        expect(expand('echo $USER "${HOME}/x"')).toBe('echo ana "/home/ana/x"');
    });

    it('leaves single-quoted text alone', () => {
        expect(expand("echo '$USER' $USER")).toBe("echo '$USER' ana");
    });

    it('treats an apostrophe inside double quotes or without a pair as text', () => {
        expect(expand('echo "it\'s $USER"')).toBe('echo "it\'s ana"');
        expect(expand("echo it's $USER")).toBe("echo it's ana");
    });

    it('expands $? and a leading ~', () => {
        expect(expand('echo $? ~/docs', 2)).toBe('echo 2 /home/ana/docs');
        expect(expand("echo '~'")).toBe("echo '~'");
    });
});

import {
    coreExportNames,
    evaluatePlayground,
    missingCoreImports,
    PlaygroundError,
} from './playground-runner';
import { playgroundUrl, readPlaygroundFragment } from '../../../../shared/playground-link';

describe('Playground links', () => {
    it('round-trip code and commands through the URL fragment', async () => {
        const code = "export class A {\n    command = 'héllo ✓';\n}\n";
        const url = await playgroundUrl({ code, commands: 'greet Ada\nhelp' });

        expect(url).toMatch(/^\/docs\/playground#code=z[\w-]+&run=z[\w-]+$/);
        const snippet = await readPlaygroundFragment(url.slice(url.indexOf('#')));
        expect(snippet).toEqual({ code, commands: 'greet Ada\nhelp' });
    });

    it('leave out empty commands', async () => {
        const url = await playgroundUrl({ code: 'x', commands: '  ' });
        expect(url).not.toContain('run=');
        expect((await readPlaygroundFragment(url.split('#')[1]))?.commands).toBeUndefined();
    });

    it('ignore fragments without code and damaged ones', async () => {
        expect(await readPlaygroundFragment('#section-1')).toBeUndefined();
        expect(await readPlaygroundFragment('#code=z%%%')).toBeUndefined();
    });
});

describe('Playground runner', () => {
    it('runs an exported processor class', () => {
        const modules = evaluatePlayground(`
            class Greet { constructor() { this.command = 'greet'; } processCommand() {} }
            exports.Greet = Greet;`);

        expect(modules.length).toBe(1);
        expect(modules[0].name).toBe('playground');
        expect(modules[0].processors?.[0].command).toBe('greet');
    });

    it('takes processor objects, default exports and modules', () => {
        const modules = evaluatePlayground(`
            exports.default = { command: 'a', processCommand() {} };
            exports.b = { command: 'b', processCommand() {} };
            exports.mod = { apiVersion: 2, name: 'mine', processors: [] };`);

        expect(modules.map((m) => m.name)).toEqual(['playground', 'mine']);
        expect(modules[0].processors?.map((p) => p.command)).toEqual(['a', 'b']);
    });

    it('gives the code @qodalis/cli-core', () => {
        const modules = evaluatePlayground(`
            const core = require('@qodalis/cli-core');
            exports.p = { command: 'v', version: core.API_VERSION, processCommand() {} };`);

        expect((modules[0].processors?.[0] as unknown as { version: number }).version).toBe(2);
    });

    it('explains what to export when nothing runnable is exported', () => {
        expect(() => evaluatePlayground('exports.x = 1;')).toThrowMatching(
            (e) => e instanceof PlaygroundError && /export a command processor/.test(e.message),
        );
    });

    it('names the packages that can be imported', () => {
        expect(() => evaluatePlayground("require('lodash');")).toThrowMatching(
            (e) => e instanceof PlaygroundError && /'lodash' is not available/.test(e.message),
        );
    });

    it('lets errors thrown by the code through', () => {
        expect(() => evaluatePlayground("throw new Error('boom');")).toThrowError('boom');
    });
});

describe('Playground imports', () => {
    const dts = `interface ICliCommandProcessor {}
declare class CliIcon {}
export declare const API_VERSION = 2;
export { CliIcon, Other as Renamed };
export type { ICliCommandProcessor, CliProcessCommand };`;

    it('reads every export name of the type definitions', () => {
        const names = coreExportNames(dts);
        for (const name of ['API_VERSION', 'CliIcon', 'Renamed', 'ICliCommandProcessor', 'CliProcessCommand']) {
            expect(names.has(name)).withContext(name).toBeTrue();
        }
        expect(names.has('Other')).toBeFalse();
    });

    it('adds an import for undefined names that cli-core exports', () => {
        const fixed = missingCoreImports('class A implements ICliCommandProcessor {}', coreExportNames(dts), [
            'ICliCommandProcessor',
            'CliProcessCommand',
            'ICliCommandProcessor',
            'NotInCore',
        ]);
        expect(fixed.split('\n')[0]).toBe(
            "import { CliProcessCommand, ICliCommandProcessor } from '@qodalis/cli-core';",
        );
    });

    it('leaves code without such names alone', () => {
        expect(missingCoreImports('const a = 1;', coreExportNames(dts), ['NotInCore'])).toBe('const a = 1;');
    });
});

import { ICliCommandChildProcessor, ICliCommandProcessor } from '@qodalis/cli-core';
import { CliTestHarness } from '../lib/testing';
import {
    CliAliasCommandProcessor,
    CliConvertCommandProcessor,
    CliJsonCommandProcessor,
    CliSeqCommandProcessor,
    CliSnippetCommandProcessor,
    CliUnAliasCommandProcessor,
    CliYesCommandProcessor,
} from '../lib/processors';
import { splitPackageArgs } from '../lib/processors/system/packages/package-utils';

function withParents<T extends ICliCommandProcessor>(processor: T): T {
    for (const sub of processor.processors ?? []) {
        (sub as ICliCommandChildProcessor).parent = processor;
    }
    return processor;
}

describe('built-in processors with quoted arguments', () => {
    let harness: CliTestHarness;

    beforeEach(() => {
        harness = new CliTestHarness();
    });

    it('alias accepts name="command" and --name="command"', async () => {
        harness.registerProcessor(withParents(new CliAliasCommandProcessor()));
        let result = await harness.execute('alias ll="ls -la"');
        expect(result.output).toContain('ll -> ls -la');
        expect(result.output).not.toContain('"');
        result = await harness.execute('alias --cls="clear screen"');
        expect(result.output).toContain('cls -> clear screen');
        result = await harness.execute('alias ls');
        expect(result.output).toContain('ll -> ls -la');
        expect(result.output).toContain('cls -> clear screen');
    });

    it('unalias takes a quoted name', async () => {
        harness.registerProcessors([
            withParents(new CliAliasCommandProcessor()),
            new CliUnAliasCommandProcessor(),
        ]);
        await harness.execute('alias ll="ls -la"');
        const result = await harness.execute('unalias "ll"');
        expect(result.stderr).toEqual([]);
    });

    it('snippet save keeps a quoted template and run takes quoted values', async () => {
        harness.registerProcessor(withParents(new CliSnippetCommandProcessor()));
        await harness.execute(`snippet save greet "say 'hi' {{name}}"`);
        let result = await harness.execute('snippet show greet');
        expect(result.output).toContain(`say 'hi' {{name}}`);

        await harness.execute('snippet save raw echo "a b" {{x}}');
        result = await harness.execute('snippet show raw');
        expect(result.output).toContain('echo "a b" {{x}}');
    });

    it('seq reads quoted numbers', async () => {
        harness.registerProcessor(new CliSeqCommandProcessor());
        expect((await harness.execute('seq "1" 3')).output).toBe('1\n2\n3');
        expect((await harness.execute('seq 2')).output).toBe('1\n2');
    });

    it('yes repeats a quoted text without its quotes', async () => {
        harness.registerProcessor(new CliYesCommandProcessor());
        const result = await harness.execute('yes "a b" --count=2');
        expect(result.stdout).toEqual(['a b', 'a b']);
    });

    it('json format accepts JSON in single quotes', async () => {
        harness.registerProcessor(withParents(new CliJsonCommandProcessor()));
        const result = await harness.execute(`json minify '{ "a b": [1, 2] }'`);
        expect(result.output).toBe('{"a b":[1,2]}');
        const unquoted = await harness.execute('json minify {"a":1}');
        expect(unquoted.output).toBe('{"a":1}');
    });

    it('convert reads a quoted amount', async () => {
        harness.registerProcessor(new CliConvertCommandProcessor());
        const result = await harness.execute('convert "100 km" to m');
        expect(result.stderr).toEqual([]);
        expect(result.output).toContain('100000');
    });

    it('pkg splits package names like a shell', () => {
        expect(splitPackageArgs(`guid  "string" 'qr'`)).toEqual(['guid', 'string', 'qr']);
    });
});

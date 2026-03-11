import { CommandParser, CommandPart, ParsedToken } from '../lib/parsers/command-parser';
import { CliArgsParser } from '../lib/parsers/args-parser';
import { reconcileArgs } from '../lib/parsers/reconcile-args';
import { CapturingTerminalWriter } from '../lib/services/capturing-terminal-writer';
import {
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    ICliTerminalWriter,
    CliForegroundColor,
    CliBackgroundColor,
} from '@qodalis/cli-core';

// ---------------------------------------------------------------------------
// CommandParser
// ---------------------------------------------------------------------------
describe('CommandParser', () => {
    let parser: CommandParser;

    beforeEach(() => {
        parser = new CommandParser();
    });

    // -- Basic commands --

    it('should parse a single-word command', () => {
        const result = parser.parse('help');
        expect(result.commandName).toBe('help');
        expect(result.args.length).toBe(0);
    });

    it('should parse a two-word command', () => {
        const result = parser.parse('echo hello');
        expect(result.commandName).toBe('echo hello');
        expect(result.args.length).toBe(0);
    });

    it('should parse a multi-word chained command', () => {
        const result = parser.parse('git commit amend');
        expect(result.commandName).toBe('git commit amend');
    });

    it('should return empty command for empty input', () => {
        const result = parser.parse('');
        expect(result.commandName).toBe('');
        expect(result.args.length).toBe(0);
    });

    it('should return empty command for whitespace-only input', () => {
        const result = parser.parse('   ');
        expect(result.commandName).toBe('');
        expect(result.args.length).toBe(0);
    });

    // -- Double-dash flags --

    it('should parse --flag as boolean true', () => {
        const result = parser.parse('build --verbose');
        expect(result.commandName).toBe('build');
        expect(result.args).toEqual([{ name: 'verbose', value: true }]);
    });

    it('should parse --key=value', () => {
        const result = parser.parse('build --output=dist');
        expect(result.args).toEqual([{ name: 'output', value: 'dist' }]);
    });

    it('should parse multiple flags', () => {
        const result = parser.parse('build --verbose --output=dist');
        expect(result.commandName).toBe('build');
        expect(result.args.length).toBe(2);
        expect(result.args).toContain(
            jasmine.objectContaining({ name: 'verbose', value: true }),
        );
        expect(result.args).toContain(
            jasmine.objectContaining({ name: 'output', value: 'dist' }),
        );
    });

    it('should parse flags with hyphens in names', () => {
        const result = parser.parse('run --dry-run --max-retries=3');
        expect(result.args).toContain(
            jasmine.objectContaining({ name: 'dry-run', value: true }),
        );
        expect(result.args).toContain(
            jasmine.objectContaining({ name: 'max-retries', value: 3 }),
        );
    });

    it('should parse flags with underscores in names', () => {
        const result = parser.parse('run --log_level=debug');
        expect(result.args).toEqual([{ name: 'log_level', value: 'debug' }]);
    });

    // -- Single-dash flags --

    it('should parse -f as boolean true', () => {
        const result = parser.parse('test -v');
        expect(result.commandName).toBe('test');
        expect(result.args).toEqual([{ name: 'v', value: true }]);
    });

    it('should parse -k=value', () => {
        const result = parser.parse('test -o=dist');
        expect(result.args).toEqual([{ name: 'o', value: 'dist' }]);
    });

    it('should parse mixed single and double-dash flags', () => {
        const result = parser.parse('build -v --output=dist');
        expect(result.commandName).toBe('build');
        expect(result.args.length).toBe(2);
        expect(result.args).toContain(
            jasmine.objectContaining({ name: 'v', value: true }),
        );
        expect(result.args).toContain(
            jasmine.objectContaining({ name: 'output', value: 'dist' }),
        );
    });

    // -- Quoted values --

    it('should parse double-quoted value', () => {
        const result = parser.parse('echo --msg="hello world"');
        expect(result.args[0].value).toBe('hello world');
    });

    it('should parse single-quoted value', () => {
        const result = parser.parse("echo --msg='hello world'");
        expect(result.args[0].value).toBe('hello world');
    });

    it('should parse empty double-quoted value', () => {
        const result = parser.parse('echo --msg=""');
        expect(result.args[0].value).toBe('');
    });

    it('should parse empty single-quoted value', () => {
        const result = parser.parse("echo --msg=''");
        expect(result.args[0].value).toBe('');
    });

    it('should preserve spaces in quoted values', () => {
        const result = parser.parse('echo --text="  spaces  "');
        expect(result.args[0].value).toBe('  spaces  ');
    });

    // -- Numeric value coercion --

    it('should coerce integer values to numbers', () => {
        const result = parser.parse('test --count=5');
        expect(result.args[0].value).toBe(5);
    });

    it('should coerce negative integer values', () => {
        const result = parser.parse('test --offset=-10');
        expect(result.args[0].value).toBe(-10);
    });

    it('should coerce float values to numbers', () => {
        const result = parser.parse('test --ratio=3.14');
        expect(result.args[0].value).toBe(3.14);
    });

    it('should coerce zero to number', () => {
        const result = parser.parse('test --count=0');
        expect(result.args[0].value).toBe(0);
    });

    // -- Boolean string coercion --

    it('should coerce "true" string to boolean true', () => {
        const result = parser.parse('test --flag=true');
        expect(result.args[0].value).toBe(true);
    });

    it('should coerce "false" string to boolean false', () => {
        const result = parser.parse('test --flag=false');
        expect(result.args[0].value).toBe(false);
    });

    // -- Commands with args interleaved --

    it('should parse command words before and after flags', () => {
        const result = parser.parse('git --verbose commit');
        // flags come before command words — command words are "git" and "commit"
        expect(result.commandName).toBe('git commit');
        expect(result.args).toContain(
            jasmine.objectContaining({ name: 'verbose', value: true }),
        );
    });

    it('should handle flag at the beginning', () => {
        const result = parser.parse('--help build');
        expect(result.commandName).toBe('build');
        expect(result.args).toContain(
            jasmine.objectContaining({ name: 'help', value: true }),
        );
    });

    // -- Edge cases --

    it('should handle a command that is just a flag', () => {
        const result = parser.parse('--version');
        expect(result.commandName).toBe('');
        expect(result.args).toEqual([{ name: 'version', value: true }]);
    });

    it('should handle duplicate flag names', () => {
        const result = parser.parse('test --tag=a --tag=b');
        expect(result.args.length).toBe(2);
        expect(result.args[0]).toEqual({ name: 'tag', value: 'a' });
        expect(result.args[1]).toEqual({ name: 'tag', value: 'b' });
    });

    it('should handle flags with numeric names', () => {
        const result = parser.parse('test --123=abc');
        expect(result.args).toEqual([{ name: '123', value: 'abc' }]);
    });

    it('should handle command names with mixed case', () => {
        const result = parser.parse('MyCommand SubCmd');
        expect(result.commandName).toBe('MyCommand SubCmd');
    });

    it('should ignore a standalone dash', () => {
        // a bare `-` matches the non-flag alternative but starts with `-`
        // so it is filtered out — neither a flag nor a command part
        const result = parser.parse('test -');
        expect(result.commandName).toBe('test');
        expect(result.args.length).toBe(0);
    });

    it('should parse a realistic complex command', () => {
        const result = parser.parse(
            'curl https://api.example.com --method=POST --header="Content-Type: application/json" -v',
        );
        expect(result.commandName).toBe('curl https://api.example.com');
        expect(result.args.length).toBe(3);
        expect(result.args).toContain(
            jasmine.objectContaining({ name: 'method', value: 'POST' }),
        );
        expect(result.args).toContain(
            jasmine.objectContaining({
                name: 'header',
                value: 'Content-Type: application/json',
            }),
        );
        expect(result.args).toContain(
            jasmine.objectContaining({ name: 'v', value: true }),
        );
    });
});

// ---------------------------------------------------------------------------
// CliArgsParser
// ---------------------------------------------------------------------------
describe('CliArgsParser', () => {
    function makeProcessor(
        parameters: ICliCommandParameterDescriptor[],
    ): ICliCommandProcessor {
        return {
            command: 'test',
            parameters,
            processCommand: async () => {},
        };
    }

    // -- Boolean type --

    it('should convert boolean flag (no value) to true for boolean parameter', () => {
        const processor = makeProcessor([
            {
                name: 'verbose',
                type: 'boolean',
                required: false,
                description: '',
            },
        ]);
        const result = CliArgsParser.convertToRecord(
            [{ name: 'verbose', value: true }],
            processor,
        );
        expect(result['verbose']).toBe(true);
    });

    it('should convert "true" string to true for boolean parameter', () => {
        const processor = makeProcessor([
            { name: 'flag', type: 'boolean', required: false, description: '' },
        ]);
        expect(
            CliArgsParser.convertToRecord(
                [{ name: 'flag', value: 'true' }],
                processor,
            )['flag'],
        ).toBe(true);
    });

    it('should convert "yes" and "y" to true for boolean parameter', () => {
        const processor = makeProcessor([
            { name: 'flag', type: 'boolean', required: false, description: '' },
        ]);
        expect(
            CliArgsParser.convertToRecord(
                [{ name: 'flag', value: 'yes' }],
                processor,
            )['flag'],
        ).toBe(true);
        expect(
            CliArgsParser.convertToRecord(
                [{ name: 'flag', value: 'y' }],
                processor,
            )['flag'],
        ).toBe(true);
    });

    it('should convert "1" and numeric 1 to true for boolean parameter', () => {
        const processor = makeProcessor([
            { name: 'flag', type: 'boolean', required: false, description: '' },
        ]);
        expect(
            CliArgsParser.convertToRecord(
                [{ name: 'flag', value: '1' }],
                processor,
            )['flag'],
        ).toBe(true);
        expect(
            CliArgsParser.convertToRecord(
                [{ name: 'flag', value: 1 }],
                processor,
            )['flag'],
        ).toBe(true);
    });

    it('should convert "false" and other strings to false for boolean parameter', () => {
        const processor = makeProcessor([
            { name: 'flag', type: 'boolean', required: false, description: '' },
        ]);
        expect(
            CliArgsParser.convertToRecord(
                [{ name: 'flag', value: 'false' }],
                processor,
            )['flag'],
        ).toBe(false);
        expect(
            CliArgsParser.convertToRecord(
                [{ name: 'flag', value: 'no' }],
                processor,
            )['flag'],
        ).toBe(false);
        expect(
            CliArgsParser.convertToRecord(
                [{ name: 'flag', value: 'random' }],
                processor,
            )['flag'],
        ).toBe(false);
    });

    // -- Array type --

    it('should accumulate repeated args into an array', () => {
        const processor = makeProcessor([
            { name: 'tags', type: 'array', required: false, description: '' },
        ]);
        const result = CliArgsParser.convertToRecord(
            [
                { name: 'tags', value: 'alpha' },
                { name: 'tags', value: 'beta' },
                { name: 'tags', value: 'gamma' },
            ],
            processor,
        );
        expect(result['tags']).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('should accumulate array values when using aliases', () => {
        const processor = makeProcessor([
            {
                name: 'tags',
                aliases: ['t'],
                type: 'array',
                required: false,
                description: '',
            },
        ]);
        const result = CliArgsParser.convertToRecord(
            [
                { name: 't', value: 'alpha' },
                { name: 't', value: 'beta' },
            ],
            processor,
        );
        expect(result['tags']).toEqual(['alpha', 'beta']);
        expect(result['t']).toEqual(['alpha', 'beta']);
    });

    it('should accumulate array values across canonical name and alias', () => {
        const processor = makeProcessor([
            {
                name: 'tags',
                aliases: ['t'],
                type: 'array',
                required: false,
                description: '',
            },
        ]);
        const result = CliArgsParser.convertToRecord(
            [
                { name: 'tags', value: 'first' },
                { name: 't', value: 'second' },
            ],
            processor,
        );
        expect(result['tags']).toEqual(['first', 'second']);
        expect(result['t']).toEqual(['first', 'second']);
    });

    it('should create single-element array for one array arg', () => {
        const processor = makeProcessor([
            { name: 'files', type: 'array', required: false, description: '' },
        ]);
        const result = CliArgsParser.convertToRecord(
            [{ name: 'files', value: 'readme.md' }],
            processor,
        );
        expect(result['files']).toEqual(['readme.md']);
    });

    // -- String type (default) --

    it('should pass through string values', () => {
        const processor = makeProcessor([
            { name: 'name', type: 'string', required: false, description: '' },
        ]);
        const result = CliArgsParser.convertToRecord(
            [{ name: 'name', value: 'Alice' }],
            processor,
        );
        expect(result['name']).toBe('Alice');
    });

    it('should pass through numeric values for string parameters', () => {
        const processor = makeProcessor([
            { name: 'port', type: 'string', required: false, description: '' },
        ]);
        const result = CliArgsParser.convertToRecord(
            [{ name: 'port', value: 8080 }],
            processor,
        );
        expect(result['port']).toBe(8080);
    });

    // -- Number type --

    it('should pass through number values for number parameters', () => {
        const processor = makeProcessor([
            { name: 'count', type: 'number', required: false, description: '' },
        ]);
        const result = CliArgsParser.convertToRecord(
            [{ name: 'count', value: 42 }],
            processor,
        );
        expect(result['count']).toBe(42);
    });

    // -- Aliases --

    it('should set both canonical name and alias to same value', () => {
        const processor = makeProcessor([
            {
                name: 'output',
                aliases: ['o'],
                type: 'string',
                required: false,
                description: '',
            },
        ]);
        const result = CliArgsParser.convertToRecord(
            [{ name: 'o', value: 'dist' }],
            processor,
        );
        expect(result['output']).toBe('dist');
        expect(result['o']).toBe('dist');
    });

    it('should handle multiple aliases', () => {
        const processor = makeProcessor([
            {
                name: 'verbose',
                aliases: ['v', 'V'],
                type: 'boolean',
                required: false,
                description: '',
            },
        ]);
        const result = CliArgsParser.convertToRecord(
            [{ name: 'V', value: true }],
            processor,
        );
        expect(result['verbose']).toBe(true);
        expect(result['v']).toBe(true);
        expect(result['V']).toBe(true);
    });

    it('should handle canonical name input with aliases defined', () => {
        const processor = makeProcessor([
            {
                name: 'output',
                aliases: ['o'],
                type: 'string',
                required: false,
                description: '',
            },
        ]);
        const result = CliArgsParser.convertToRecord(
            [{ name: 'output', value: 'build' }],
            processor,
        );
        expect(result['output']).toBe('build');
        expect(result['o']).toBe('build');
    });

    // -- Unknown parameters --

    it('should pass through unknown args without conversion', () => {
        const processor = makeProcessor([]);
        const result = CliArgsParser.convertToRecord(
            [{ name: 'unknown', value: 'hello' }],
            processor,
        );
        expect(result['unknown']).toBe('hello');
    });

    it('should pass through unknown boolean flags', () => {
        const processor = makeProcessor([]);
        const result = CliArgsParser.convertToRecord(
            [{ name: 'debug', value: true }],
            processor,
        );
        expect(result['debug']).toBe(true);
    });

    // -- No parameters defined --

    it('should handle processor with no parameters property', () => {
        const processor: ICliCommandProcessor = {
            command: 'test',
            processCommand: async () => {},
        };
        const result = CliArgsParser.convertToRecord(
            [{ name: 'flag', value: true }],
            processor,
        );
        expect(result['flag']).toBe(true);
    });

    // -- Empty args --

    it('should return empty record for no args', () => {
        const processor = makeProcessor([
            {
                name: 'verbose',
                type: 'boolean',
                required: false,
                description: '',
            },
        ]);
        const result = CliArgsParser.convertToRecord([], processor);
        expect(Object.keys(result).length).toBe(0);
    });

    // -- Mixed known and unknown args --

    it('should handle mix of known and unknown args', () => {
        const processor = makeProcessor([
            {
                name: 'output',
                aliases: ['o'],
                type: 'string',
                required: false,
                description: '',
            },
        ]);
        const result = CliArgsParser.convertToRecord(
            [
                { name: 'o', value: 'dist' },
                { name: 'random', value: 'stuff' },
            ],
            processor,
        );
        expect(result['output']).toBe('dist');
        expect(result['o']).toBe('dist');
        expect(result['random']).toBe('stuff');
    });
});

// ---------------------------------------------------------------------------
// CommandParser.splitByOperators
// ---------------------------------------------------------------------------
describe('CommandParser.splitByOperators', () => {
    // -- && operator --

    it('should split two commands by &&', () => {
        const parts = CommandParser.splitByOperators(
            'echo hello && echo world',
        );
        expect(parts).toEqual([
            { type: 'command', value: 'echo hello' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'echo world' },
        ]);
    });

    it('should split three commands by &&', () => {
        const parts = CommandParser.splitByOperators('a && b && c');
        expect(parts).toEqual([
            { type: 'command', value: 'a' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'b' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'c' },
        ]);
    });

    // -- || operator --

    it('should split two commands by ||', () => {
        const parts = CommandParser.splitByOperators('cmd1 || cmd2');
        expect(parts).toEqual([
            { type: 'command', value: 'cmd1' },
            { type: '||', value: '||' },
            { type: 'command', value: 'cmd2' },
        ]);
    });

    // -- >> operator --

    it('should split command and redirect target by >>', () => {
        const parts = CommandParser.splitByOperators(
            'echo hello >> output.txt',
        );
        expect(parts).toEqual([
            { type: 'command', value: 'echo hello' },
            { type: '>>', value: '>>' },
            { type: 'command', value: 'output.txt' },
        ]);
    });

    // -- Mixed operators --

    it('should split mixed && and ||', () => {
        const parts = CommandParser.splitByOperators('a && b || c');
        expect(parts).toEqual([
            { type: 'command', value: 'a' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'b' },
            { type: '||', value: '||' },
            { type: 'command', value: 'c' },
        ]);
    });

    it('should handle && followed by >>', () => {
        const parts = CommandParser.splitByOperators(
            'build && echo done >> log.txt',
        );
        expect(parts).toEqual([
            { type: 'command', value: 'build' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'echo done' },
            { type: '>>', value: '>>' },
            { type: 'command', value: 'log.txt' },
        ]);
    });

    // -- No operators --

    it('should return single command when no operators', () => {
        const parts = CommandParser.splitByOperators('echo hello');
        expect(parts).toEqual([{ type: 'command', value: 'echo hello' }]);
    });

    it('should return empty array for empty input', () => {
        const parts = CommandParser.splitByOperators('');
        expect(parts).toEqual([]);
    });

    it('should return empty array for whitespace-only input', () => {
        const parts = CommandParser.splitByOperators('   ');
        expect(parts).toEqual([]);
    });

    // -- Edge cases --

    it('should handle operators with no spaces', () => {
        const parts = CommandParser.splitByOperators('a&&b');
        expect(parts).toEqual([
            { type: 'command', value: 'a' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'b' },
        ]);
    });

    it('should handle operator at start of input', () => {
        const parts = CommandParser.splitByOperators('&& cmd');
        expect(parts).toEqual([
            { type: '&&', value: '&&' },
            { type: 'command', value: 'cmd' },
        ]);
    });

    it('should handle operator at end of input', () => {
        const parts = CommandParser.splitByOperators('cmd &&');
        expect(parts).toEqual([
            { type: 'command', value: 'cmd' },
            { type: '&&', value: '&&' },
        ]);
    });

    it('should handle consecutive operators', () => {
        const parts = CommandParser.splitByOperators('a && && b');
        expect(parts).toEqual([
            { type: 'command', value: 'a' },
            { type: '&&', value: '&&' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'b' },
        ]);
    });

    it('should preserve flags in commands', () => {
        const parts = CommandParser.splitByOperators(
            'build --verbose && test -v',
        );
        expect(parts).toEqual([
            { type: 'command', value: 'build --verbose' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'test -v' },
        ]);
    });

    it('should not split on && inside double-quoted strings', () => {
        const parts = CommandParser.splitByOperators('echo "a && b"');
        expect(parts).toEqual([{ type: 'command', value: 'echo "a && b"' }]);
    });

    it('should not split on || inside single-quoted strings', () => {
        const parts = CommandParser.splitByOperators("echo 'a || b'");
        expect(parts).toEqual([{ type: 'command', value: "echo 'a || b'" }]);
    });

    it('should not split on >> inside double-quoted strings', () => {
        const parts = CommandParser.splitByOperators('echo "data >> file"');
        expect(parts).toEqual([
            { type: 'command', value: 'echo "data >> file"' },
        ]);
    });

    it('should split on operators outside quotes but not inside', () => {
        const parts = CommandParser.splitByOperators('echo "a && b" && echo c');
        expect(parts).toEqual([
            { type: 'command', value: 'echo "a && b"' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'echo c' },
        ]);
    });

    it('should handle --flag="value with &&" correctly', () => {
        const parts = CommandParser.splitByOperators(
            'cmd --msg="hello && world" && other',
        );
        expect(parts).toEqual([
            { type: 'command', value: 'cmd --msg="hello && world"' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'other' },
        ]);
    });

    it('should handle mixed quote types with operators', () => {
        const parts = CommandParser.splitByOperators(
            `echo "a || b" && echo 'c && d'`,
        );
        expect(parts).toEqual([
            { type: 'command', value: 'echo "a || b"' },
            { type: '&&', value: '&&' },
            { type: 'command', value: "echo 'c && d'" },
        ]);
    });

    it('should not split on | inside quoted strings', () => {
        const parts = CommandParser.splitByOperators('echo "a | b"');
        expect(parts).toEqual([{ type: 'command', value: 'echo "a | b"' }]);
    });

    it('should handle >> redirect with path containing slashes', () => {
        const parts = CommandParser.splitByOperators(
            'echo data >> /home/user/log.txt',
        );
        expect(parts).toEqual([
            { type: 'command', value: 'echo data' },
            { type: '>>', value: '>>' },
            { type: 'command', value: '/home/user/log.txt' },
        ]);
    });

    // -- Pipe operator --

    it('should split two commands by |', () => {
        const parts = CommandParser.splitByOperators(
            'echo hello | base64 encode',
        );
        expect(parts).toEqual([
            { type: 'command', value: 'echo hello' },
            { type: '|', value: '|' },
            { type: 'command', value: 'base64 encode' },
        ]);
    });

    it('should split three commands by |', () => {
        const parts = CommandParser.splitByOperators('a | b | c');
        expect(parts).toEqual([
            { type: 'command', value: 'a' },
            { type: '|', value: '|' },
            { type: 'command', value: 'b' },
            { type: '|', value: '|' },
            { type: 'command', value: 'c' },
        ]);
    });

    it('should distinguish | from ||', () => {
        const parts = CommandParser.splitByOperators('a | b || c');
        expect(parts).toEqual([
            { type: 'command', value: 'a' },
            { type: '|', value: '|' },
            { type: 'command', value: 'b' },
            { type: '||', value: '||' },
            { type: 'command', value: 'c' },
        ]);
    });

    it('should handle | with no spaces', () => {
        const parts = CommandParser.splitByOperators('a|b');
        expect(parts).toEqual([
            { type: 'command', value: 'a' },
            { type: '|', value: '|' },
            { type: 'command', value: 'b' },
        ]);
    });

    it('should handle pipe combined with && and >>', () => {
        const parts = CommandParser.splitByOperators(
            'echo hello | base64 encode && echo done >> log.txt',
        );
        expect(parts).toEqual([
            { type: 'command', value: 'echo hello' },
            { type: '|', value: '|' },
            { type: 'command', value: 'base64 encode' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'echo done' },
            { type: '>>', value: '>>' },
            { type: 'command', value: 'log.txt' },
        ]);
    });

    // -- ; operator --

    it('should split two commands by ;', () => {
        const parts = CommandParser.splitByOperators('echo hello ; echo world');
        expect(parts).toEqual([
            { type: 'command', value: 'echo hello' },
            { type: ';', value: ';' },
            { type: 'command', value: 'echo world' },
        ]);
    });

    it('should split three commands by ;', () => {
        const parts = CommandParser.splitByOperators('a ; b ; c');
        expect(parts).toEqual([
            { type: 'command', value: 'a' },
            { type: ';', value: ';' },
            { type: 'command', value: 'b' },
            { type: ';', value: ';' },
            { type: 'command', value: 'c' },
        ]);
    });

    it('should handle ; with no spaces', () => {
        const parts = CommandParser.splitByOperators('a;b');
        expect(parts).toEqual([
            { type: 'command', value: 'a' },
            { type: ';', value: ';' },
            { type: 'command', value: 'b' },
        ]);
    });

    it('should not split on ; inside quoted strings', () => {
        const parts = CommandParser.splitByOperators('echo "a ; b"');
        expect(parts).toEqual([{ type: 'command', value: 'echo "a ; b"' }]);
    });

    it('should handle mixed ; and && operators', () => {
        const parts = CommandParser.splitByOperators('a ; b && c');
        expect(parts).toEqual([
            { type: 'command', value: 'a' },
            { type: ';', value: ';' },
            { type: 'command', value: 'b' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'c' },
        ]);
    });

    // -- > operator --

    it('should split command and redirect target by >', () => {
        const parts = CommandParser.splitByOperators('echo hello > output.txt');
        expect(parts).toEqual([
            { type: 'command', value: 'echo hello' },
            { type: '>', value: '>' },
            { type: 'command', value: 'output.txt' },
        ]);
    });

    it('should distinguish > from >>', () => {
        const parts = CommandParser.splitByOperators('echo a > out.txt && echo b >> out.txt');
        expect(parts).toEqual([
            { type: 'command', value: 'echo a' },
            { type: '>', value: '>' },
            { type: 'command', value: 'out.txt' },
            { type: '&&', value: '&&' },
            { type: 'command', value: 'echo b' },
            { type: '>>', value: '>>' },
            { type: 'command', value: 'out.txt' },
        ]);
    });

    it('should not split on > inside quoted strings', () => {
        const parts = CommandParser.splitByOperators('echo "a > b"');
        expect(parts).toEqual([{ type: 'command', value: 'echo "a > b"' }]);
    });

    // -- 2> and 2>> operators --

    it('should split command and stderr redirect by 2>', () => {
        const parts = CommandParser.splitByOperators('cmd 2> errors.txt');
        expect(parts).toEqual([
            { type: 'command', value: 'cmd' },
            { type: '2>', value: '2>' },
            { type: 'command', value: 'errors.txt' },
        ]);
    });

    it('should split command and stderr append by 2>>', () => {
        const parts = CommandParser.splitByOperators('cmd 2>> errors.txt');
        expect(parts).toEqual([
            { type: 'command', value: 'cmd' },
            { type: '2>>', value: '2>>' },
            { type: 'command', value: 'errors.txt' },
        ]);
    });

    it('should distinguish 2> from > and 2>> from >>', () => {
        const parts = CommandParser.splitByOperators('cmd > out.txt 2> err.txt');
        expect(parts).toEqual([
            { type: 'command', value: 'cmd' },
            { type: '>', value: '>' },
            { type: 'command', value: 'out.txt' },
            { type: '2>', value: '2>' },
            { type: 'command', value: 'err.txt' },
        ]);
    });

    it('should not split 2> inside quotes', () => {
        const parts = CommandParser.splitByOperators('echo "2> not redirect"');
        expect(parts).toEqual([{ type: 'command', value: 'echo "2> not redirect"' }]);
    });
});

// ---------------------------------------------------------------------------
// CommandParser.parse — tokens field
// ---------------------------------------------------------------------------
describe('CommandParser.parse tokens', () => {
    let parser: CommandParser;

    beforeEach(() => {
        parser = new CommandParser();
    });

    it('should emit word tokens for command parts', () => {
        const result = parser.parse('ssh connect');
        expect(result.tokens).toEqual([
            { kind: 'word', value: 'ssh' },
            { kind: 'word', value: 'connect' },
        ]);
    });

    it('should emit flag tokens with hasEquals=false for bare flags', () => {
        const result = parser.parse('build --verbose');
        expect(result.tokens).toEqual([
            { kind: 'word', value: 'build' },
            { kind: 'flag', name: 'verbose', value: true, hasEquals: false },
        ]);
    });

    it('should emit flag tokens with hasEquals=true for --key=value', () => {
        const result = parser.parse('build --output=dist');
        expect(result.tokens).toEqual([
            { kind: 'word', value: 'build' },
            { kind: 'flag', name: 'output', value: 'dist', hasEquals: true },
        ]);
    });

    it('should emit tokens in source order', () => {
        const result = parser.parse('ssh --server dotnet --verbose');
        expect(result.tokens).toEqual([
            { kind: 'word', value: 'ssh' },
            { kind: 'flag', name: 'server', value: true, hasEquals: false },
            { kind: 'word', value: 'dotnet' },
            { kind: 'flag', name: 'verbose', value: true, hasEquals: false },
        ]);
    });
});

// ---------------------------------------------------------------------------
// reconcileArgs
// ---------------------------------------------------------------------------
describe('reconcileArgs', () => {
    function desc(
        name: string,
        type: string,
        aliases?: string[],
    ): ICliCommandParameterDescriptor {
        return { name, type, required: false, description: '', aliases };
    }

    it('should consume next word for string param (--server dotnet)', () => {
        const tokens: ParsedToken[] = [
            { kind: 'word', value: 'ssh' },
            { kind: 'flag', name: 'server', value: true, hasEquals: false },
            { kind: 'word', value: 'dotnet' },
        ];
        const result = reconcileArgs(tokens, [desc('server', 'string')]);
        expect(result.args).toEqual([{ name: 'server', value: 'dotnet' }]);
        expect(result.commandParts).toEqual(['ssh']);
    });

    it('should keep equals format working (--server=dotnet)', () => {
        const tokens: ParsedToken[] = [
            { kind: 'word', value: 'ssh' },
            { kind: 'flag', name: 'server', value: 'dotnet', hasEquals: true },
        ];
        const result = reconcileArgs(tokens, [desc('server', 'string')]);
        expect(result.args).toEqual([{ name: 'server', value: 'dotnet' }]);
        expect(result.commandParts).toEqual(['ssh']);
    });

    it('should NOT consume next word for boolean flag', () => {
        const tokens: ParsedToken[] = [
            { kind: 'word', value: 'build' },
            { kind: 'flag', name: 'verbose', value: true, hasEquals: false },
            { kind: 'word', value: 'extra' },
        ];
        const result = reconcileArgs(tokens, [desc('verbose', 'boolean')]);
        expect(result.args).toEqual([{ name: 'verbose', value: true }]);
        expect(result.commandParts).toEqual(['build', 'extra']);
    });

    it('should handle --verbose dotnet where verbose is boolean', () => {
        const tokens: ParsedToken[] = [
            { kind: 'flag', name: 'verbose', value: true, hasEquals: false },
            { kind: 'word', value: 'dotnet' },
        ];
        const result = reconcileArgs(tokens, [desc('verbose', 'boolean')]);
        expect(result.args).toEqual([{ name: 'verbose', value: true }]);
        expect(result.commandParts).toEqual(['dotnet']);
    });

    it('should consume and parse number value (--count 5)', () => {
        const tokens: ParsedToken[] = [
            { kind: 'word', value: 'cmd' },
            { kind: 'flag', name: 'count', value: true, hasEquals: false },
            { kind: 'word', value: '5' },
        ];
        const result = reconcileArgs(tokens, [desc('count', 'number')]);
        expect(result.args).toEqual([{ name: 'count', value: 5 }]);
        expect(result.commandParts).toEqual(['cmd']);
    });

    it('should handle mixed params (--server dotnet --verbose)', () => {
        const tokens: ParsedToken[] = [
            { kind: 'word', value: 'ssh' },
            { kind: 'flag', name: 'server', value: true, hasEquals: false },
            { kind: 'word', value: 'dotnet' },
            { kind: 'flag', name: 'verbose', value: true, hasEquals: false },
        ];
        const result = reconcileArgs(tokens, [
            desc('server', 'string'),
            desc('verbose', 'boolean'),
        ]);
        expect(result.args).toEqual([
            { name: 'server', value: 'dotnet' },
            { name: 'verbose', value: true },
        ]);
        expect(result.commandParts).toEqual(['ssh']);
    });

    it('should keep flag as boolean when no next token (--server at end)', () => {
        const tokens: ParsedToken[] = [
            { kind: 'word', value: 'ssh' },
            { kind: 'flag', name: 'server', value: true, hasEquals: false },
        ];
        const result = reconcileArgs(tokens, [desc('server', 'string')]);
        expect(result.args).toEqual([{ name: 'server', value: true }]);
        expect(result.commandParts).toEqual(['ssh']);
    });

    it('should not consume word for unknown flag (no descriptor match)', () => {
        const tokens: ParsedToken[] = [
            { kind: 'flag', name: 'unknown-flag', value: true, hasEquals: false },
            { kind: 'word', value: 'value' },
        ];
        const result = reconcileArgs(tokens, [desc('server', 'string')]);
        expect(result.args).toEqual([{ name: 'unknown-flag', value: true }]);
        expect(result.commandParts).toEqual(['value']);
    });

    it('should not consume next flag token as value', () => {
        const tokens: ParsedToken[] = [
            { kind: 'flag', name: 'server', value: true, hasEquals: false },
            { kind: 'flag', name: 'verbose', value: true, hasEquals: false },
        ];
        const result = reconcileArgs(tokens, [
            desc('server', 'string'),
            desc('verbose', 'boolean'),
        ]);
        expect(result.args).toEqual([
            { name: 'server', value: true },
            { name: 'verbose', value: true },
        ]);
        expect(result.commandParts).toEqual([]);
    });

    it('should handle aliases when matching descriptors', () => {
        const tokens: ParsedToken[] = [
            { kind: 'word', value: 'cmd' },
            { kind: 'flag', name: 's', value: true, hasEquals: false },
            { kind: 'word', value: 'dotnet' },
        ];
        const result = reconcileArgs(tokens, [
            desc('server', 'string', ['s']),
        ]);
        expect(result.args).toEqual([{ name: 's', value: 'dotnet' }]);
        expect(result.commandParts).toEqual(['cmd']);
    });

    it('should handle undefined descriptors gracefully', () => {
        const tokens: ParsedToken[] = [
            { kind: 'word', value: 'cmd' },
            { kind: 'flag', name: 'flag', value: true, hasEquals: false },
            { kind: 'word', value: 'val' },
        ];
        const result = reconcileArgs(tokens, undefined);
        expect(result.args).toEqual([{ name: 'flag', value: true }]);
        expect(result.commandParts).toEqual(['cmd', 'val']);
    });

    it('should handle end-to-end: ssh --server dotnet with SSH-like descriptors', () => {
        const parser = new CommandParser();
        const parsed = parser.parse('ssh --server dotnet');

        const descriptors: ICliCommandParameterDescriptor[] = [
            desc('server', 'string', ['s']),
            desc('verbose', 'boolean', ['v']),
        ];

        const result = reconcileArgs(parsed.tokens, descriptors);
        expect(result.args).toEqual([{ name: 'server', value: 'dotnet' }]);
        expect(result.commandParts).toEqual(['ssh']);
    });

    it('end-to-end: equals format still works after reconciliation', () => {
        const parser = new CommandParser();
        const parsed = parser.parse('ssh --server=dotnet --verbose');

        const descriptors: ICliCommandParameterDescriptor[] = [
            desc('server', 'string', ['s']),
            desc('verbose', 'boolean', ['v']),
        ];

        const result = reconcileArgs(parsed.tokens, descriptors);
        expect(result.args).toEqual([
            { name: 'server', value: 'dotnet' },
            { name: 'verbose', value: true },
        ]);
        expect(result.commandParts).toEqual(['ssh']);
    });
});

// ---------------------------------------------------------------------------
// CapturingTerminalWriter — stderr capture
// ---------------------------------------------------------------------------
describe('CapturingTerminalWriter stderr capture', () => {
    function createStubWriter(): ICliTerminalWriter {
        return {
            write: () => {},
            writeln: () => {},
            writeSuccess: () => {},
            writeInfo: () => {},
            writeError: () => {},
            writeWarning: () => {},
            wrapInColor: (text: string) => text,
            wrapInBackgroundColor: (text: string) => text,
            writeJson: () => {},
            writeToFile: () => {},
            writeObjectsAsTable: () => {},
            writeTable: () => {},
            writeDivider: () => {},
            writeList: () => {},
            writeKeyValue: () => {},
            writeColumns: () => {},
        } as ICliTerminalWriter;
    }

    it('should capture stderr from writeError', () => {
        const inner = createStubWriter();
        const capturing = new CapturingTerminalWriter(inner);

        capturing.writeln('stdout line');
        capturing.writeError('stderr line');

        expect(capturing.getCapturedData()).toBe('stdout line');
        expect(capturing.getCapturedStderr()).toBe('stderr line');
        expect(capturing.hasStderr()).toBeTrue();
    });

    it('should capture stderr from writeWarning', () => {
        const inner = createStubWriter();
        const capturing = new CapturingTerminalWriter(inner);

        capturing.writeWarning('warn msg');

        expect(capturing.getCapturedStderr()).toBe('warn msg');
        expect(capturing.hasStderr()).toBeTrue();
    });

    it('should return undefined when no stderr captured', () => {
        const inner = createStubWriter();
        const capturing = new CapturingTerminalWriter(inner);

        capturing.writeln('only stdout');

        expect(capturing.getCapturedStderr()).toBeUndefined();
        expect(capturing.hasStderr()).toBeFalse();
    });

    it('should capture multiple stderr lines', () => {
        const inner = createStubWriter();
        const capturing = new CapturingTerminalWriter(inner);

        capturing.writeError('error 1');
        capturing.writeWarning('warning 1');
        capturing.writeError('error 2');

        expect(capturing.getCapturedStderr()).toBe('error 1\nwarning 1\nerror 2');
    });

    it('should not mix stderr into stdout capture', () => {
        const inner = createStubWriter();
        const capturing = new CapturingTerminalWriter(inner);

        capturing.writeln('stdout');
        capturing.writeError('stderr');

        expect(capturing.getCapturedData()).toBe('stdout');
        expect(capturing.getCapturedStderr()).toBe('stderr');
    });
});

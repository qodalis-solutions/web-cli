import {
    getRightOfWord,
    getParameterValue,
    toQueryString,
    highlightTextWithBg,
    colorFirstWord,
    colorizeJson,
    formatJson,
    ObjectDescriber,
    delay,
    compareVersions,
    satisfiesMinVersion,
} from '../lib';
import { CliBackgroundColor, CliForegroundColor } from '../lib/models';
import { CancellablePromise, CANCELLATION_ERROR_MESSAGE } from '../lib/types/CancellablePromise';
import { CliModuleRegistry } from '../lib/modules/cli-module-registry';
import { ICliModule } from '../lib/interfaces';

// ---------------------------------------------------------------------------
// getRightOfWord
// ---------------------------------------------------------------------------
describe('getRightOfWord', () => {
    it('should return text to the right of the word', () => {
        expect(getRightOfWord('regex validate invalid', 'validate')).toBe(
            'invalid',
        );
    });

    it('should return empty string when word is at the end', () => {
        expect(getRightOfWord('hello world', 'world')).toBe('');
    });

    it('should return undefined when word is not found', () => {
        expect(getRightOfWord('hello world', 'missing')).toBeUndefined();
    });

    it('should trim whitespace from result', () => {
        expect(getRightOfWord('cmd   arg1   arg2', 'arg1')).toBe('arg2');
    });

    it('should match first occurrence of the word', () => {
        expect(getRightOfWord('echo echo hello', 'echo')).toBe('echo hello');
    });
});

// ---------------------------------------------------------------------------
// getParameterValue
// ---------------------------------------------------------------------------
describe('getParameterValue', () => {
    it('should return value by parameter name', () => {
        const param = {
            name: 'output',
            type: 'string' as const,
            description: '',
            required: false,
        };
        expect(getParameterValue(param, { output: 'file.txt' })).toBe(
            'file.txt',
        );
    });

    it('should return value by alias', () => {
        const param = {
            name: 'output',
            aliases: ['o'],
            type: 'string' as const,
            description: '',
            required: false,
        };
        expect(getParameterValue(param, { o: 'file.txt' })).toBe('file.txt');
    });

    it('should prefer name over alias', () => {
        const param = {
            name: 'output',
            aliases: ['o'],
            type: 'string' as const,
            description: '',
            required: false,
        };
        expect(
            getParameterValue(param, { output: 'byName', o: 'byAlias' }),
        ).toBe('byName');
    });

    it('should return undefined when not found', () => {
        const param = {
            name: 'output',
            type: 'string' as const,
            description: '',
            required: false,
        };
        expect(getParameterValue(param, { other: 'val' })).toBeUndefined();
    });

    it('should handle falsy values correctly', () => {
        const param = {
            name: 'flag',
            type: 'boolean' as const,
            description: '',
            required: false,
        };
        expect(getParameterValue(param, { flag: false })).toBe(false);
        expect(getParameterValue(param, { flag: 0 })).toBe(0);
        expect(getParameterValue(param, { flag: '' })).toBe('');
    });
});

// ---------------------------------------------------------------------------
// toQueryString
// ---------------------------------------------------------------------------
describe('toQueryString', () => {
    it('should convert simple key-value pairs', () => {
        expect(toQueryString({ a: '1', b: '2' })).toBe('a=1&b=2');
    });

    it('should handle arrays', () => {
        const result = toQueryString({ tags: ['a', 'b'] });
        expect(result).toBe('tags=a&tags=b');
    });

    it('should skip null and undefined values', () => {
        expect(toQueryString({ a: '1', b: null, c: undefined })).toBe('a=1');
    });

    it('should convert numbers to strings', () => {
        expect(toQueryString({ page: 3 })).toBe('page=3');
    });

    it('should return empty string for empty object', () => {
        expect(toQueryString({})).toBe('');
    });
});

// ---------------------------------------------------------------------------
// highlightTextWithBg
// ---------------------------------------------------------------------------
describe('highlightTextWithBg', () => {
    it('should wrap matched text with background color codes', () => {
        const result = highlightTextWithBg('hello world', /world/);
        expect(result).toContain(CliBackgroundColor.Yellow);
        expect(result).toContain(CliForegroundColor.Reset);
        expect(result).toContain('world');
    });

    it('should use custom background color', () => {
        const result = highlightTextWithBg(
            'hello',
            /hello/,
            CliBackgroundColor.Red,
        );
        expect(result).toContain(CliBackgroundColor.Red);
    });

    it('should not modify text when pattern does not match', () => {
        expect(highlightTextWithBg('hello', /xyz/)).toBe('hello');
    });
});

// ---------------------------------------------------------------------------
// colorFirstWord
// ---------------------------------------------------------------------------
describe('colorFirstWord', () => {
    it('should apply color function to first word', () => {
        const result = colorFirstWord('hello world', (w) => `[${w}]`);
        expect(result).toBe('[hello] world');
    });

    it('should preserve leading whitespace', () => {
        const result = colorFirstWord('  indented text', (w) => `<${w}>`);
        expect(result).toBe('  <indented> text');
    });

    it('should handle single word', () => {
        const result = colorFirstWord('solo', (w) => `(${w})`);
        expect(result).toBe('(solo)');
    });

    it('should return empty/falsy text unchanged', () => {
        expect(colorFirstWord('', (w) => `[${w}]`)).toBe('');
    });
});

// ---------------------------------------------------------------------------
// colorizeJson / formatJson
// ---------------------------------------------------------------------------
describe('colorizeJson', () => {
    it('should colorize JSON keys in cyan', () => {
        const result = colorizeJson('"name": "value"');
        expect(result).toContain('\x1b[36m"name"');
    });

    it('should colorize string values in green', () => {
        const result = colorizeJson('"name": "hello"');
        expect(result).toContain('\x1b[32m"hello"');
    });

    it('should colorize numbers in yellow', () => {
        const result = colorizeJson('"count": 42');
        expect(result).toContain('\x1b[33m42');
    });

    it('should colorize booleans in yellow', () => {
        const result = colorizeJson('"flag": true');
        expect(result).toContain('\x1b[33mtrue');
    });

    it('should colorize null in yellow', () => {
        const result = colorizeJson('"val": null');
        expect(result).toContain('\x1b[33mnull');
    });

    it('should colorize brackets in gray', () => {
        const result = colorizeJson('{}');
        expect(result).toContain('\x1b[90m{');
        expect(result).toContain('\x1b[90m}');
    });

    it('should handle negative and decimal numbers', () => {
        const result = colorizeJson('"n": -3.14');
        expect(result).toContain('\x1b[33m-3.14');
    });

    it('should handle input with no matches', () => {
        const result = colorizeJson('plain text');
        expect(result).toBe('plain text');
    });
});

describe('formatJson', () => {
    it('should produce indented colorized output', () => {
        const result = formatJson({ a: 1 });
        expect(result).toContain('"a"');
        expect(result).toContain('1');
    });

    it('should use \\r\\n line endings', () => {
        const result = formatJson({ a: 1, b: 2 });
        expect(result).toContain('\r\n');
    });
});

// ---------------------------------------------------------------------------
// compareVersions / satisfiesMinVersion
// ---------------------------------------------------------------------------
describe('compareVersions', () => {
    it('should return 0 for equal versions', () => {
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should return 1 when first is greater', () => {
        expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    });

    it('should return -1 when first is smaller', () => {
        expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    });

    it('should compare minor versions', () => {
        expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
        expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
    });

    it('should compare patch versions', () => {
        expect(compareVersions('1.0.3', '1.0.2')).toBe(1);
        expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    });

    it('should handle different length versions', () => {
        expect(compareVersions('1.0', '1.0.0')).toBe(0);
        expect(compareVersions('1.0.1', '1.0')).toBe(1);
    });

    it('should handle multi-digit segments', () => {
        expect(compareVersions('1.0.37', '0.0.16')).toBe(1);
        expect(compareVersions('10.0.0', '9.9.9')).toBe(1);
    });
});

describe('satisfiesMinVersion', () => {
    it('should return true when installed equals required', () => {
        expect(satisfiesMinVersion('1.0.0', '1.0.0')).toBeTrue();
    });

    it('should return true when installed is greater', () => {
        expect(satisfiesMinVersion('2.0.0', '1.0.0')).toBeTrue();
    });

    it('should return false when installed is lower', () => {
        expect(satisfiesMinVersion('0.9.0', '1.0.0')).toBeFalse();
    });
});

// ---------------------------------------------------------------------------
// delay
// ---------------------------------------------------------------------------
describe('delay', () => {
    it('should resolve after the specified time', async () => {
        const start = Date.now();
        await delay(50);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('should return a promise', () => {
        const result = delay(0);
        expect(result).toBeInstanceOf(Promise);
    });
});

// ---------------------------------------------------------------------------
// ObjectDescriber
// ---------------------------------------------------------------------------
describe('ObjectDescriber', () => {
    describe('getFunctionArguments', () => {
        it('should extract named arguments', () => {
            const fn = function (a: any, b: any) {};
            expect(ObjectDescriber.getFunctionArguments(fn)).toEqual([
                'a',
                'b',
            ]);
        });

        it('should return empty array for no-arg functions', () => {
            const fn = function () {};
            expect(ObjectDescriber.getFunctionArguments(fn)).toEqual([]);
        });
    });

    describe('supportsDynamicArgs', () => {
        it('should return true when function uses arguments keyword', () => {
            // eslint-disable-next-line prefer-rest-params
            const fn = function () {
                return arguments;
            };
            expect(ObjectDescriber.supportsDynamicArgs(fn)).toBeTrue();
        });

        it('should return false for normal functions', () => {
            const fn = function (a: any) {
                return a;
            };
            expect(ObjectDescriber.supportsDynamicArgs(fn)).toBeFalse();
        });
    });

    describe('describe', () => {
        it('should create processors for multi-arg functions', () => {
            const obj: Record<string, Function> = {};
            // Use regular functions so toString() is consistent across browsers
            obj['add'] = function (value: any, b: any) {
                return Number(value) + Number(b);
            };
            obj['multiply'] = function (value: any, factor: any) {
                return Number(value) * Number(factor);
            };

            const processors = ObjectDescriber.describe(obj);
            expect(processors.length).toBeGreaterThanOrEqual(2);
            expect(processors.some((p) => p.command === 'add')).toBeTrue();
            expect(processors.some((p) => p.command === 'multiply')).toBeTrue();
        });

        it('should create processors for single-arg functions', () => {
            const obj: Record<string, Function> = {};
            obj['upper'] = function (value: any) {
                return String(value).toUpperCase();
            };

            const processors = ObjectDescriber.describe(obj);
            expect(processors.some((p) => p.command === 'upper')).toBeTrue();
        });

        it('should skip functions with no arguments and no dynamic args', () => {
            const obj: Record<string, Function> = {};
            obj['noArgs'] = function () {
                return 42;
            };
            obj['hasArg'] = function (x: any) {
                return x;
            };

            const processors = ObjectDescriber.describe(obj);
            const commands = processors.map((p) => p.command);
            expect(commands).not.toContain('noArgs');
            expect(commands).toContain('hasArg');
        });

        it('should apply filter', () => {
            const obj: Record<string, Function> = {};
            obj['keep'] = function (x: any) {
                return x;
            };
            obj['skip'] = function (x: any) {
                return x;
            };

            const processors = ObjectDescriber.describe(obj, {
                filter: ({ funcName }) => funcName === 'keep',
            });
            expect(processors.length).toBe(1);
            expect(processors[0].command).toBe('keep');
        });

        it('should skip functions with "function" or "func" arguments', () => {
            const obj: Record<string, Function> = {};
            obj['withCallback'] = function (value: any, func: any) {
                return func(value);
            };

            const processors = ObjectDescriber.describe(obj);
            expect(processors.map((p) => p.command)).not.toContain(
                'withCallback',
            );
        });
    });
});

// ---------------------------------------------------------------------------
// CancellablePromise
// ---------------------------------------------------------------------------
describe('CancellablePromise', () => {
    it('should resolve with value', async () => {
        const cp = new CancellablePromise<string>((resolve) => {
            setTimeout(() => resolve('done'), 10);
        });
        const result = await cp.execute();
        expect(result).toBe('done');
    });

    it('should reject with error', async () => {
        const cp = new CancellablePromise<string>((_, reject) => {
            setTimeout(() => reject('fail'), 10);
        });
        await cp.execute().then(
            () => fail('should have rejected'),
            (err) => expect(err).toBe('fail'),
        );
    });

    it('should reject with cancellation error when cancelled', async () => {
        const cp = new CancellablePromise<string>((resolve) => {
            setTimeout(() => resolve('too late'), 100);
        });

        const promise = cp.execute();
        cp.cancel();

        await promise.then(
            () => fail('should have been cancelled'),
            (err) => expect(err.message).toBe(CANCELLATION_ERROR_MESSAGE),
        );
    });

    it('should not resolve after cancellation', async () => {
        let resolved = false;
        const cp = new CancellablePromise<void>((resolve) => {
            setTimeout(() => {
                resolve();
                resolved = true;
            }, 50);
        });

        const promise = cp.execute().catch(() => {});
        cp.cancel();
        await promise;

        // Even if the executor calls resolve, the promise should not have resolved
        // (it rejected via abort)
        expect(resolved).toBeFalse();
    });
});

// ---------------------------------------------------------------------------
// CliModuleRegistry
// ---------------------------------------------------------------------------
describe('CliModuleRegistry', () => {
    let registry: CliModuleRegistry;

    const createModule = (name: string): ICliModule => ({
        apiVersion: 2,
        name,
        version: '1.0.0',
        description: `Module ${name}`,
    });

    beforeEach(() => {
        registry = new CliModuleRegistry();
    });

    it('should register and retrieve a module', async () => {
        const mod = createModule('test');
        await registry.register(mod);
        expect(registry.getModule('test')).toBe(mod);
    });

    it('should return undefined for unknown modules', () => {
        expect(registry.getModule('unknown')).toBeUndefined();
    });

    it('should list all registered modules', async () => {
        await registry.register(createModule('a'));
        await registry.register(createModule('b'));
        const all = registry.getAll();
        expect(all.length).toBe(2);
        expect(all.map((m) => m.name)).toEqual(['a', 'b']);
    });

    it('should call boot handlers on register', async () => {
        const bootedNames: string[] = [];
        registry.onModuleBoot(async (mod) => {
            bootedNames.push(mod.name);
        });

        await registry.register(createModule('alpha'));
        await registry.register(createModule('beta'));

        expect(bootedNames).toEqual(['alpha', 'beta']);
    });

    it('should support multiple boot handlers', async () => {
        let handler1Called = false;
        let handler2Called = false;

        registry.onModuleBoot(async () => {
            handler1Called = true;
        });
        registry.onModuleBoot(async () => {
            handler2Called = true;
        });

        await registry.register(createModule('test'));

        expect(handler1Called).toBeTrue();
        expect(handler2Called).toBeTrue();
    });

    it('should track module without triggering boot handlers', () => {
        const bootedNames: string[] = [];
        registry.onModuleBoot(async (mod) => {
            bootedNames.push(mod.name);
        });

        const mod = createModule('tracked');
        registry.track(mod);

        expect(bootedNames.length).toBe(0);
        expect(registry.getModule('tracked')).toBe(mod);
    });

    it('should check if module exists with has()', async () => {
        await registry.register(createModule('existing'));
        expect(registry.has('existing')).toBeTrue();
        expect(registry.has('missing')).toBeFalse();
    });

    it('should overwrite module with same name on re-register', async () => {
        const mod1 = createModule('dup');
        mod1.version = '1.0.0';
        const mod2 = createModule('dup');
        mod2.version = '2.0.0';

        await registry.register(mod1);
        await registry.register(mod2);

        expect(registry.getModule('dup')?.version).toBe('2.0.0');
        expect(registry.getAll().length).toBe(1);
    });
});

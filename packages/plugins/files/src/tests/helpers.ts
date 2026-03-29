import { Subject } from 'rxjs';
import {
    CliProcessCommand,
    CliForegroundColor,
    CliBackgroundColor,
    ICliExecutionContext,
    ICliTerminalWriter,
    ICliServiceProvider,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { IFileSystemService_TOKEN } from '../lib/interfaces';

export function createStubWriter(): ICliTerminalWriter & { written: string[] } {
    const written: string[] = [];
    return {
        written,
        write(text: string) { written.push(text); },
        writeln(text?: string) { written.push(text ?? ''); },
        writeSuccess(msg: string) { written.push(`[success] ${msg}`); },
        writeInfo(msg: string) { written.push(`[info] ${msg}`); },
        writeWarning(msg: string) { written.push(`[warn] ${msg}`); },
        writeError(msg: string) { written.push(`[error] ${msg}`); },
        wrapInColor(text: string, _color: CliForegroundColor) { return text; },
        wrapInBackgroundColor(text: string, _color: CliBackgroundColor) { return text; },
        writeJson(json: any) { written.push(JSON.stringify(json)); },
        writeToFile(_fn: string, _content: string) {},
        writeObjectsAsTable(objects: any[]) { written.push(JSON.stringify(objects)); },
        writeTable(_h: string[], _r: string[][]) {},
        writeDivider() {},
        writeList(_items: string[], _options?: any) {},
        writeKeyValue(_entries: any, _options?: any) {},
        writeColumns(_items: string[], _options?: any) {},
        writeLink(_text: string, _url: string) {},
        writeBox(_content: string | string[], _options?: any) {},
        writeIndented(_text: string, _level?: number) {},
    };
}

export function createMockContext(
    writer: ICliTerminalWriter,
    fs: IndexedDbFileSystemService,
): ICliExecutionContext {
    const services: ICliServiceProvider = {
        get<T>(token: any): T | undefined {
            if (token === IFileSystemService_TOKEN) return fs as any;
            return undefined;
        },
        getAll<T>(_token: any): T[] { return []; },
        getRequired<T>(token: any): T {
            const result = this.get<T>(token);
            if (result === undefined) throw new Error(`Unknown service: ${token}`);
            return result;
        },
        has(_token: any): boolean {
            return false;
        },
        set() {},
    };

    return {
        writer,
        services,
        spinner: { show() {}, hide() {} },
        progressBar: { show() {}, update() {}, hide() {} },
        onAbort: new Subject<void>(),
        terminal: {} as any,
        reader: {} as any,
        executor: {} as any,
        clipboard: {} as any,
        options: undefined,
        logger: { log() {}, info() {}, warn() {}, error() {}, debug() {}, setCliLogLevel() {} },
        process: { output() {}, exit() {} } as any,
        state: {} as any,
        showPrompt: jasmine.createSpy('showPrompt'),
        setContextProcessor: jasmine.createSpy('setContextProcessor'),
        setCurrentLine: jasmine.createSpy('setCurrentLine'),
        clearLine: jasmine.createSpy('clearLine'),
        clearCurrentLine: jasmine.createSpy('clearCurrentLine'),
        refreshCurrentLine: jasmine.createSpy('refreshCurrentLine'),
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
    } as any;
}

/**
 * Build a CliProcessCommand matching executor behavior:
 * - flags (tokens starting with -) go into `args` as booleans
 * - non-flag tokens (after the command name) form `value`
 * - for flags with values (e.g. -n 5, -d ','), pass them via `args`
 *
 * Explicit `args` override any flags parsed from the string.
 */
export function makeCommand(
    raw: string,
    args: Record<string, any> = {},
    data?: any,
): CliProcessCommand {
    const tokens = raw.split(/\s+/).filter(Boolean);
    const command = tokens[0];
    const parsedArgs: Record<string, any> = {};
    const valueParts: string[] = [];

    for (let i = 1; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.startsWith('--')) {
            const eqIdx = t.indexOf('=');
            if (eqIdx !== -1) {
                parsedArgs[t.slice(2, eqIdx)] = t.slice(eqIdx + 1);
            } else {
                parsedArgs[t.slice(2)] = true;
            }
        } else if (t.startsWith('-') && t.length > 1) {
            parsedArgs[t.slice(1)] = true;
        } else {
            valueParts.push(t);
        }
    }

    const value = valueParts.length > 0 ? valueParts.join(' ') : undefined;
    const mergedArgs = { ...parsedArgs, ...args };

    return {
        command,
        rawCommand: raw,
        value,
        chainCommands: [],
        args: mergedArgs,
        data,
    } as any;
}

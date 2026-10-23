import * as cliCore from '@qodalis/cli-core';
import * as cli from '@qodalis/cli';
import { ICliCommandProcessor, ICliModule } from '@qodalis/cli-core';

/** Packages the playground code can import; both are already loaded by the docs. */
const PACKAGES: Record<string, unknown> = {
    '@qodalis/cli-core': cliCore,
    '@qodalis/cli': cli,
};

export class PlaygroundError extends Error {}

/**
 * Runs the compiled (CommonJS) playground code and returns what it exports, as
 * modules for the engine: exported modules as they are, plus one module with
 * every exported command processor (a class, or an object with processCommand).
 */
export function evaluatePlayground(js: string): ICliModule[] {
    const module = { exports: {} as Record<string, unknown> };
    const require = (name: string): unknown => {
        if (name in PACKAGES) return PACKAGES[name];
        throw new PlaygroundError(
            `'${name}' is not available in the playground: import from ${Object.keys(PACKAGES).join(' or ')}.`,
        );
    };
    // The code is the reader's own, compiled in their browser, like any JS playground
    new Function('require', 'exports', 'module', js)(require, module.exports, module);

    const modules: ICliModule[] = [];
    const processors: ICliCommandProcessor[] = [];
    for (const value of Object.values(module.exports)) {
        if (isModule(value)) modules.push(value);
        else if (isProcessorClass(value)) processors.push(new value());
        else if (isProcessor(value)) processors.push(value);
    }
    if (processors.length) {
        modules.unshift({ apiVersion: 2, name: 'playground', processors });
    }
    if (!modules.length) {
        throw new PlaygroundError(
            'Nothing to run: export a command processor (a class or an object with processCommand) or a module.',
        );
    }
    return modules;
}

/**
 * Names used in the code without an import that @qodalis/cli-core exports, for
 * examples copied from the docs, where imports are often left out.
 */
export function missingCoreImports(code: string, coreExports: Set<string>, undefinedNames: string[]): string {
    const names = [...new Set(undefinedNames)].filter((n) => coreExports.has(n));
    if (!names.length) return code;
    return `import { ${names.sort().join(', ')} } from '@qodalis/cli-core';\n\n${code}`;
}

/** Export names of the bundled cli-core type definitions. */
export function coreExportNames(dts: string): Set<string> {
    const names = new Set<string>();
    for (const m of dts.matchAll(/export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type|const|let|function|enum)\s+([A-Za-z_$][\w$]*)/g)) {
        names.add(m[1]);
    }
    for (const m of dts.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
        for (const part of m[1].split(',')) {
            const name = part.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, '').trim();
            if (name) names.add(name);
        }
    }
    return names;
}

function isModule(value: unknown): value is ICliModule {
    return (
        !!value &&
        typeof value === 'object' &&
        typeof (value as ICliModule).name === 'string' &&
        ('apiVersion' in value || Array.isArray((value as ICliModule).processors))
    );
}

function isProcessor(value: unknown): value is ICliCommandProcessor {
    return (
        !!value &&
        typeof value === 'object' &&
        typeof (value as ICliCommandProcessor).command === 'string' &&
        typeof (value as ICliCommandProcessor).processCommand === 'function'
    );
}

function isProcessorClass(value: unknown): value is new () => ICliCommandProcessor {
    return typeof value === 'function' && typeof value.prototype?.processCommand === 'function';
}

/**
 * Global environment variable store for the CLI session.
 *
 * Variables set here are available to all commands via `$VAR` / `${VAR}`
 * substitution in the executor. Commands can also read/write the store
 * directly through the service provider.
 */
export interface ICliEnvironment {
    /** Get a variable value (undefined if not set). */
    get(name: string): string | undefined;

    /** Set a variable. */
    set(name: string, value: string): void;

    /** Remove a variable. */
    unset(name: string): void;

    /** Get all variables as a record. */
    getAll(): Record<string, string>;

    /** Check if a variable is set. */
    has(name: string): boolean;
}

export const ICliEnvironment_TOKEN = 'cli-environment';

/**
 * Default in-memory implementation.
 * Seeded with some standard variables on construction.
 */
export class CliEnvironment implements ICliEnvironment {
    private readonly vars: Map<string, string>;

    constructor() {
        this.vars = new Map<string, string>();

        // Seed with standard variables
        this.vars.set('SHELL', '/bin/sh');
        this.vars.set('TERM', 'xterm-256color');
        this.vars.set('LANG', 'en_US.UTF-8');
        this.vars.set('PWD', '/');
        this.vars.set('HOME', '/home/user');
        this.vars.set('USER', 'user');
        this.vars.set('PATH', '/usr/local/bin:/usr/bin:/bin');
    }

    get(name: string): string | undefined {
        return this.vars.get(name);
    }

    set(name: string, value: string): void {
        this.vars.set(name, value);
    }

    unset(name: string): void {
        this.vars.delete(name);
    }

    getAll(): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [k, v] of this.vars) {
            result[k] = v;
        }
        return result;
    }

    has(name: string): boolean {
        return this.vars.has(name);
    }
}

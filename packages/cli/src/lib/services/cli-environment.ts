import { createCliToken } from '@qodalis/cli-core';
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

export const ICliEnvironment_TOKEN =
    createCliToken<ICliEnvironment>('cli-environment');

/** What one user (or the signed-out session, key '') changed: values set and defaults removed. */
export interface CliEnvironmentProfile {
    vars: Record<string, string>;
    unset: string[];
}

/** Saved environment: one profile per user name ('' when nobody is signed in). */
export type CliEnvironmentSnapshot = Record<string, CliEnvironmentProfile>;

/**
 * Default in-memory implementation.
 *
 * A variable resolves, in order, from the current user's own changes (`set`/`unset`),
 * then bound live values (USER, HOME, PWD follow the session and directory), then the
 * standard variables seeded on construction. Each user has a separate set of changes,
 * so `su`/`login` switch environments, and `onChange` lets the host save them.
 */
export class CliEnvironment implements ICliEnvironment {
    private readonly defaults = new Map<string, string>();
    /** Variables computed on read; a user's own value wins over them. */
    private readonly bound = new Map<string, () => string | null | undefined>();
    private readonly profiles = new Map<string, { vars: Map<string, string>; unset: Set<string> }>();
    private profileKey: () => string = () => '';

    /** Called after every change with the full snapshot (to persist it). */
    onChange?: (snapshot: CliEnvironmentSnapshot) => void;

    constructor() {
        // Seed with standard variables
        this.defaults.set('SHELL', '/bin/sh');
        this.defaults.set('TERM', 'xterm-256color');
        this.defaults.set('LANG', 'en_US.UTF-8');
        this.defaults.set('PWD', '/');
        this.defaults.set('HOME', '/home/user');
        this.defaults.set('USER', 'user');
        this.defaults.set('PATH', '/usr/local/bin:/usr/bin:/bin');
    }

    /** Compute a variable on every read; the seeded value is the fallback while it returns nothing. */
    bind(name: string, resolver: () => string | null | undefined): void {
        this.bound.set(name, resolver);
    }

    /** Pick whose changes apply (the signed-in user's name, '' when signed out). */
    setProfileResolver(resolver: () => string | null | undefined): void {
        this.profileKey = () => resolver() ?? '';
    }

    /** Restore saved profiles (replaces the ones in memory). */
    load(snapshot: CliEnvironmentSnapshot | undefined): void {
        this.profiles.clear();
        for (const [key, profile] of Object.entries(snapshot ?? {})) {
            this.profiles.set(key, {
                vars: new Map(Object.entries(profile?.vars ?? {})),
                unset: new Set(profile?.unset ?? []),
            });
        }
    }

    snapshot(): CliEnvironmentSnapshot {
        const result: CliEnvironmentSnapshot = {};
        for (const [key, profile] of this.profiles) {
            if (!profile.vars.size && !profile.unset.size) continue;
            result[key] = { vars: Object.fromEntries(profile.vars), unset: [...profile.unset] };
        }
        return result;
    }

    get(name: string): string | undefined {
        const profile = this.profiles.get(this.profileKey());
        if (profile?.vars.has(name)) return profile.vars.get(name);
        if (profile?.unset.has(name)) return undefined;
        return this.bound.get(name)?.() || this.defaults.get(name);
    }

    set(name: string, value: string): void {
        const profile = this.currentProfile();
        profile.unset.delete(name);
        profile.vars.set(name, value);
        this.onChange?.(this.snapshot());
    }

    unset(name: string): void {
        const profile = this.currentProfile();
        profile.vars.delete(name);
        if (this.defaults.has(name) || this.bound.has(name)) profile.unset.add(name);
        this.onChange?.(this.snapshot());
    }

    getAll(): Record<string, string> {
        const profile = this.profiles.get(this.profileKey());
        const names = new Set([...this.defaults.keys(), ...this.bound.keys(), ...(profile?.vars.keys() ?? [])]);
        const result: Record<string, string> = {};
        for (const name of names) {
            const value = this.get(name);
            if (value !== undefined) result[name] = value;
        }
        return result;
    }

    has(name: string): boolean {
        return this.get(name) !== undefined;
    }

    private currentProfile(): { vars: Map<string, string>; unset: Set<string> } {
        const key = this.profileKey();
        let profile = this.profiles.get(key);
        if (!profile) {
            profile = { vars: new Map(), unset: new Set() };
            this.profiles.set(key, profile);
        }
        return profile;
    }
}

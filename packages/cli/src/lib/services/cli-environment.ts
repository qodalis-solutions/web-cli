import { createCliToken } from '@qodalis/cli-core';
/**
 * Environment variables for the CLI.
 *
 * Variables set here are available to all commands via `$VAR` / `${VAR}`
 * substitution in the executor. Commands can also read/write the store
 * directly through the service provider.
 */
export interface ICliEnvironment {
    /** Get a variable value (undefined if not set). */
    get(name: string): string | undefined;

    /**
     * Set a variable: for the signed-in user (`'user'`, the default, saved),
     * for everyone (`'global'`, saved) or for this terminal only (`'session'`).
     */
    set(name: string, value: string, scope?: CliEnvironmentScope): void;

    /**
     * Remove a variable. Without a scope it is removed for this terminal and
     * the user (and hidden when it still comes from a shared or built-in
     * value); `'global'` removes the shared value.
     */
    unset(name: string, scope?: CliEnvironmentScope): void;

    /** Get all variables as a record. */
    getAll(): Record<string, string>;

    /** Check if a variable is set. */
    has(name: string): boolean;

    /** Where the current value of `name` comes from. */
    scopeOf?(name: string): CliEnvironmentSource | undefined;
}

export const ICliEnvironment_TOKEN =
    createCliToken<ICliEnvironment>('cli-environment');

/** Where a variable is set: this terminal, the signed-in user, or everyone. */
export type CliEnvironmentScope = 'session' | 'user' | 'global';

/** Where a value comes from: a scope, or computed / built in (`HOME`, `SHELL`, …). */
export type CliEnvironmentSource = CliEnvironmentScope | 'builtin';

/** What one user (or the signed-out session, key '') changed: values set and defaults removed. */
export interface CliEnvironmentProfile {
    vars: Record<string, string>;
    unset: string[];
}

/** Saved environment: one profile per user name ('' when nobody is signed in). */
export type CliEnvironmentSnapshot = Record<string, CliEnvironmentProfile>;

/**
 * One saved change, applied by the host to the latest saved state (so two
 * tabs changing different variables never overwrite each other).
 */
export type CliEnvironmentChange =
    | { scope: 'user'; profile: string; name: string; value: string }
    | { scope: 'user'; profile: string; name: string; unset: true; hide: boolean }
    | { scope: 'global'; name: string; value: string }
    | { scope: 'global'; name: string; unset: true };

type Profile = { vars: Map<string, string>; unset: Set<string> };

/**
 * Default in-memory implementation.
 *
 * A variable resolves, in order, from this terminal's variables
 * (`NAME=value`), the current user's own (`export`), the shared ones
 * (`export --global`), then bound live values (USER, HOME, PWD follow the
 * session and directory), then the standard variables seeded on
 * construction. Each user has a separate set, so `su`/`login` switch
 * environments, and `onChange` lets the host save each change.
 */
export class CliEnvironment implements ICliEnvironment {
    private readonly defaults = new Map<string, string>();
    /** Variables computed on read; a user's own value wins over them. */
    private readonly bound = new Map<string, () => string | null | undefined>();
    private readonly profiles = new Map<string, Profile>();
    private readonly global = new Map<string, string>();
    private readonly session: Profile = { vars: new Map(), unset: new Set() };
    private profileKey: () => string = () => '';

    /** Called after every saved change (user or global), to persist it. */
    onChange?: (change: CliEnvironmentChange) => void;

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

    /** Restore saved profiles and shared variables (replaces the saved ones in memory). */
    load(snapshot: CliEnvironmentSnapshot | undefined, global?: Record<string, string>): void {
        this.profiles.clear();
        for (const [key, profile] of Object.entries(snapshot ?? {})) {
            this.profiles.set(key, {
                vars: new Map(Object.entries(profile?.vars ?? {})),
                unset: new Set(profile?.unset ?? []),
            });
        }
        this.global.clear();
        for (const [name, value] of Object.entries(global ?? {})) {
            this.global.set(name, value);
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

    /** The shared variables. */
    globals(): Record<string, string> {
        return Object.fromEntries(this.global);
    }

    get(name: string): string | undefined {
        const source = this.scopeOf(name);
        if (source === 'session') return this.session.vars.get(name);
        if (source === 'user') return this.profiles.get(this.profileKey())!.vars.get(name);
        if (source === 'global') return this.global.get(name);
        if (source === 'builtin') return this.bound.get(name)?.() || this.defaults.get(name);
        return undefined;
    }

    scopeOf(name: string): CliEnvironmentSource | undefined {
        if (this.session.vars.has(name)) return 'session';
        if (this.session.unset.has(name)) return undefined;
        const profile = this.profiles.get(this.profileKey());
        if (profile?.vars.has(name)) return 'user';
        if (profile?.unset.has(name)) return undefined;
        if (this.global.has(name)) return 'global';
        return this.bound.get(name)?.() || this.defaults.has(name) ? 'builtin' : undefined;
    }

    set(name: string, value: string, scope: CliEnvironmentScope = 'user'): void {
        if (scope === 'session') {
            this.session.unset.delete(name);
            this.session.vars.set(name, value);
            return;
        }
        // A saved value replaces this terminal's own
        this.session.vars.delete(name);
        this.session.unset.delete(name);
        if (scope === 'global') {
            this.global.set(name, value);
            this.onChange?.({ scope: 'global', name, value });
            return;
        }
        const key = this.profileKey();
        const profile = this.profileOf(key);
        profile.unset.delete(name);
        profile.vars.set(name, value);
        this.onChange?.({ scope: 'user', profile: key, name, value });
    }

    unset(name: string, scope?: CliEnvironmentScope): void {
        if (scope === 'global') {
            if (!this.global.delete(name)) return;
            this.onChange?.({ scope: 'global', name, unset: true });
            return;
        }
        this.session.vars.delete(name);
        // This terminal's value only: the saved one shows again
        if (scope === 'session') return;
        this.session.unset.delete(name);
        const key = this.profileKey();
        const profile = this.profileOf(key);
        const hadOwn = profile.vars.delete(name);
        // Still provided by a shared or built-in value: hide it for this user
        const hide = this.global.has(name) || this.defaults.has(name) || this.bound.has(name);
        if (hide) profile.unset.add(name);
        if (hadOwn || hide) {
            this.onChange?.({ scope: 'user', profile: key, name, unset: true, hide });
        }
    }

    getAll(): Record<string, string> {
        const profile = this.profiles.get(this.profileKey());
        const names = new Set([
            ...this.defaults.keys(),
            ...this.bound.keys(),
            ...this.global.keys(),
            ...(profile?.vars.keys() ?? []),
            ...this.session.vars.keys(),
        ]);
        const result: Record<string, string> = {};
        for (const name of [...names].sort()) {
            const value = this.get(name);
            if (value !== undefined) result[name] = value;
        }
        return result;
    }

    has(name: string): boolean {
        return this.get(name) !== undefined;
    }

    private profileOf(key: string): Profile {
        let profile = this.profiles.get(key);
        if (!profile) {
            profile = { vars: new Map(), unset: new Set() };
            this.profiles.set(key, profile);
        }
        return profile;
    }
}

/** Apply one change to saved state (the host does this under the cross-tab lock). */
export function applyEnvironmentChange(
    state: { profiles?: CliEnvironmentSnapshot; global?: Record<string, string> },
    change: CliEnvironmentChange,
): { profiles: CliEnvironmentSnapshot; global: Record<string, string> } {
    const profiles = { ...(state.profiles ?? {}) };
    const global = { ...(state.global ?? {}) };
    if (change.scope === 'global') {
        if ('unset' in change) delete global[change.name];
        else global[change.name] = change.value;
        return { profiles, global };
    }
    const saved = profiles[change.profile] ?? { vars: {}, unset: [] };
    const vars = { ...saved.vars };
    const unset = new Set(saved.unset);
    if ('unset' in change) {
        delete vars[change.name];
        if (change.hide) unset.add(change.name);
    } else {
        vars[change.name] = change.value;
        unset.delete(change.name);
    }
    if (Object.keys(vars).length || unset.size) {
        profiles[change.profile] = { vars, unset: [...unset] };
    } else {
        delete profiles[change.profile];
    }
    return { profiles, global };
}

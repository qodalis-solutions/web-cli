import { CliProvider, CliToken, ICliServiceProvider } from '@qodalis/cli-core';

/** One registration and, once created, its value. */
interface Registration {
    provider: CliProvider;
    resolved: boolean;
    value?: any;
}

/**
 * A simple Map-based service container implementing ICliServiceProvider.
 *
 * Supports three provider types:
 * - `useValue`   : registers a static value
 * - `useFactory` : registers a factory function, invoked once on the first `get`
 * - `useClass`   : registers a class constructor, instantiated once on the first `get`
 *
 * Factories and classes are created lazily, so their `deps` only have to be
 * registered by the time the service is first used. Add `transient: true` to
 * create a new instance on every `get`.
 *
 * When `multi: true`, multiple providers for the same token are accumulated
 * and `getAll()` returns all of them.
 *
 * Registering a single token again overrides it; removing that registration
 * (`remove(token, provider)`, e.g. when a module is unloaded) makes the
 * previous one active again.
 */
export class CliServiceContainer implements ICliServiceProvider {
    /** Single-value registrations; the last one is active. */
    private readonly services = new Map<any, Registration[]>();

    /** Multi-provider registrations, in registration order. */
    private readonly multiServices = new Map<any, Registration[]>();

    /** Tokens that cannot be overwritten by subsequent `set()` calls. */
    private readonly sealedTokens = new Set<any>();

    /** Stores provider recipes for transient tokens (re-resolved on every get). */
    private readonly transientRecipes = new Map<any, CliProvider>();

    private disposed = false;

    /** Registrations being created, to report dependency cycles. */
    private readonly resolving = new Set<Registration>();

    /**
     * Retrieve a service by its token.
     * Returns `undefined` when no provider is registered for the token.
     * For multi-provider tokens, returns the last registered value (use `getAll` for the full array).
     *
     * @param token The token used to register the service.
     * @returns The resolved service instance, or `undefined` if not registered.
     */
    get<T>(token: CliToken<T>): T | undefined;
    get<T>(token: any): T | undefined;
    get<T>(token: any): T | undefined {
        // Transient providers: create a new instance on every call
        if (this.transientRecipes.has(token)) {
            return this.resolveProvider(this.transientRecipes.get(token)!) as T;
        }

        const multi = this.multiServices.get(token);
        if (multi) {
            return this.resolve(multi[multi.length - 1]) as T;
        }

        const single = this.services.get(token);
        if (single) {
            return this.resolve(single[single.length - 1]) as T;
        }

        return undefined;
    }

    /**
     * Retrieve all registered services for a multi-provider token.
     * Returns an empty array when no provider is registered for the token.
     *
     * @param token The token used to register the service.
     * @returns Array of all resolved service instances.
     */
    getAll<T>(token: CliToken<T>): T[];
    getAll<T>(token: any): T[];
    getAll<T>(token: any): T[] {
        const multi = this.multiServices.get(token);
        if (multi) {
            return multi.map((registration) => this.resolve(registration));
        }

        // For non-multi tokens, wrap the single value in an array
        const single = this.get<T>(token);
        return single !== undefined ? [single] : [];
    }

    /**
     * Retrieve a service by its token, throwing if not registered.
     * Use this when the service is required and its absence is a programming error.
     * For multi-provider tokens, returns the last registered value (use `getAll` for the full array).
     *
     * @param token The token used to register the service.
     * @returns The resolved service instance.
     * @throws Error if the token has not been registered.
     */
    getRequired<T>(token: CliToken<T>): T;
    getRequired<T>(token: any): T;
    getRequired<T>(token: any): T {
        if (!this.has(token)) {
            throw new Error(
                `CliServiceContainer: No provider found for token "${this.tokenToString(token)}".`,
            );
        }
        return this.get<T>(token) as T;
    }

    /**
     * Check whether a service is registered for the given token.
     */
    has(token: any): boolean {
        return (
            this.services.has(token) ||
            this.multiServices.has(token) ||
            this.transientRecipes.has(token)
        );
    }

    /**
     * Mark a token as sealed so it cannot be overwritten by future `set()` calls.
     * Only available on the concrete container — not exposed on `ICliServiceProvider`.
     */
    seal(token: any): void {
        this.sealedTokens.add(token);
    }

    /**
     * Mark multiple tokens as sealed at once.
     */
    sealAll(tokens: any[]): void {
        for (const token of tokens) {
            this.sealedTokens.add(token);
        }
    }

    /**
     * Check whether a token is sealed.
     */
    isSealed(token: any): boolean {
        return this.sealedTokens.has(token);
    }

    /**
     * Register one or more providers.
     *
     * @param definition A single CliProvider or an array of CliProviders.
     */
    set(definition: CliProvider | CliProvider[]): void {
        if (Array.isArray(definition)) {
            for (const provider of definition) {
                this.registerProvider(provider);
            }
        } else {
            this.registerProvider(definition);
        }
    }

    /**
     * Remove a registration. With `provider` (the provider object passed to
     * `set`, or the registered value), only that registration is removed: for
     * a single token the previous registration becomes active again, for a
     * multi token the others remain. Without it, every registration of the
     * token is removed.
     *
     * @throws Error if the token is sealed.
     * @returns Whether something was removed.
     */
    remove(token: any, provider?: unknown): boolean {
        if (this.sealedTokens.has(token) && !this.multiServices.has(token)) {
            throw new Error(
                `CliServiceContainer: Cannot remove sealed service "${this.tokenToString(token)}".`,
            );
        }

        if (provider === undefined) {
            const removed = this.has(token);
            this.services.delete(token);
            this.multiServices.delete(token);
            this.transientRecipes.delete(token);
            return removed;
        }

        if (this.transientRecipes.get(token) === provider) {
            this.transientRecipes.delete(token);
            return true;
        }

        let removed = false;
        for (const map of [this.services, this.multiServices]) {
            const registrations = map.get(token);
            if (!registrations) continue;
            const kept = registrations.filter(
                (registration) => !this.matches(registration, provider),
            );
            if (kept.length === registrations.length) continue;
            removed = true;
            if (kept.length > 0) {
                map.set(token, kept);
            } else {
                map.delete(token);
            }
        }
        return removed;
    }

    /**
     * Dispose the services the container created (`useFactory` / `useClass`)
     * that have a `dispose()` method. Values registered with `useValue`
     * belong to whoever registered them and are not disposed. Registrations
     * are kept, so late callbacks still find their services. Called when the
     * engine is destroyed; later calls do nothing.
     */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        for (const map of [this.services, this.multiServices]) {
            for (const registrations of map.values()) {
                for (const registration of registrations) {
                    if (
                        !registration.resolved ||
                        'useValue' in registration.provider
                    ) {
                        continue;
                    }
                    const value = registration.value;
                    if (typeof value?.dispose === 'function') {
                        try {
                            value.dispose();
                        } catch (e) {
                            console.error(
                                'CliServiceContainer: Error disposing a service:',
                                e,
                            );
                        }
                    }
                }
            }
        }
    }

    /**
     * Returns all registered service tokens (single + multi providers).
     */
    getRegisteredTokens(): string[] {
        const tokens: string[] = [];
        for (const key of this.services.keys()) {
            tokens.push(this.tokenToString(key));
        }
        for (const key of this.transientRecipes.keys()) {
            tokens.push(`${this.tokenToString(key)} (transient)`);
        }
        for (const key of this.multiServices.keys()) {
            tokens.push(`${this.tokenToString(key)} (multi)`);
        }
        return tokens;
    }

    /**
     * Returns detailed info for each registered service: token name, value type, and multi flag.
     * Services not created yet are listed as `lazy(Name)` (listing does not create them).
     */
    getRegisteredServiceDetails(): {
        token: string;
        type: string;
        multi: boolean;
    }[] {
        const details: { token: string; type: string; multi: boolean }[] = [];

        for (const [key, registrations] of this.services.entries()) {
            details.push({
                token: this.tokenToString(key),
                type: this.describeRegistration(
                    registrations[registrations.length - 1],
                ),
                multi: false,
            });
        }

        for (const [key, provider] of this.transientRecipes.entries()) {
            const className =
                provider['useClass']?.name ??
                provider['useFactory']?.name ??
                'transient';
            details.push({
                token: this.tokenToString(key),
                type: `transient(${className})`,
                multi: false,
            });
        }

        for (const [key, registrations] of this.multiServices.entries()) {
            details.push({
                token: this.tokenToString(key),
                type: `[${registrations.map((r) => this.describeRegistration(r)).join(', ')}]`,
                multi: true,
            });
        }

        return details;
    }

    /**
     * Convert a token to a human-readable string for diagnostics/errors.
     */
    private tokenToString(token: any): string {
        return typeof token === 'string'
            ? token
            : typeof token === 'function'
              ? token.name
              : String(token);
    }

    private describeRegistration(registration: Registration): string {
        if (registration.resolved) {
            return this.describeValue(registration.value);
        }
        const { provider } = registration;
        const name =
            provider['useClass']?.name || provider['useFactory']?.name || '';
        return `lazy(${name || 'factory'})`;
    }

    /**
     * Describe a resolved value for diagnostic display.
     */
    private describeValue(value: any): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string')
            return `string("${value.length > 30 ? value.slice(0, 30) + '...' : value}")`;
        if (typeof value === 'number') return `number(${value})`;
        if (typeof value === 'boolean') return `boolean(${value})`;
        if (Array.isArray(value)) return `Array(${value.length})`;
        if (typeof value === 'object' && value.constructor?.name)
            return value.constructor.name;
        return typeof value;
    }

    /** Whether `registration` is the one `provider` refers to. */
    private matches(registration: Registration, provider: unknown): boolean {
        return (
            registration.provider === provider ||
            ('useValue' in registration.provider &&
                registration.provider.useValue === provider) ||
            (registration.resolved && registration.value === provider)
        );
    }

    /**
     * Register a single provider.
     */
    private registerProvider(provider: CliProvider): void {
        if (!provider.multi && this.sealedTokens.has(provider.provide)) {
            throw new Error(
                `CliServiceContainer: Cannot override sealed service "${this.tokenToString(provider.provide)}".`,
            );
        }
        if (
            !('useValue' in provider) &&
            !('useFactory' in provider) &&
            !('useClass' in provider)
        ) {
            throw new Error(
                'CliServiceContainer: Provider must specify useValue, useFactory, or useClass.',
            );
        }

        if (provider['transient'] && !provider.multi) {
            // Store the recipe — resolved fresh on every get() call
            this.transientRecipes.set(provider.provide, provider);
            this.services.delete(provider.provide); // clear any previous singleton
        } else {
            const registration: Registration = {
                provider,
                resolved: 'useValue' in provider,
                value: 'useValue' in provider ? provider.useValue : undefined,
            };

            if (provider.multi) {
                const existing = this.multiServices.get(provider.provide) ?? [];
                existing.push(registration);
                this.multiServices.set(provider.provide, existing);
            } else {
                const existing = this.services.get(provider.provide) ?? [];
                existing.push(registration);
                this.services.set(provider.provide, existing);
                this.transientRecipes.delete(provider.provide); // clear any previous transient
            }
        }

        if (provider.sealed) {
            this.sealedTokens.add(provider.provide);
        }
    }

    /** The value of a registration, created on first use. */
    private resolve(registration: Registration): any {
        if (registration.resolved) {
            return registration.value;
        }
        if (this.resolving.has(registration)) {
            throw new Error(
                `CliServiceContainer: Circular dependency while creating "${this.tokenToString(registration.provider.provide)}".`,
            );
        }
        this.resolving.add(registration);
        try {
            registration.value = this.resolveProvider(registration.provider);
            registration.resolved = true;
            return registration.value;
        } finally {
            this.resolving.delete(registration);
        }
    }

    /**
     * Resolve a provider definition to a concrete value, resolving its `deps`
     * from the container.
     */
    private resolveProvider(provider: CliProvider): any {
        if ('useValue' in provider) {
            return provider.useValue;
        }

        const deps = (provider['deps'] ?? []).map((dep: any) =>
            this.getRequired(dep),
        );

        if ('useFactory' in provider) {
            return provider.useFactory(...deps);
        }

        return new provider.useClass(...deps);
    }
}

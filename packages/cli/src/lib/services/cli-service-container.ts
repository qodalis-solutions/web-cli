import { CliProvider, ICliServiceProvider } from '@qodalis/cli-core';

/**
 * A simple Map-based service container implementing ICliServiceProvider.
 *
 * Supports three provider types:
 * - `useValue`   : registers a static value
 * - `useFactory` : registers a factory function, invoked once on first `get`
 * - `useClass`   : registers a class constructor, instantiated once on first `get`
 *
 * When `multi: true`, multiple providers for the same token are accumulated
 * and `get()` returns an array of resolved values.
 */
export class CliServiceContainer implements ICliServiceProvider {
    /** Stores single-value providers (resolved singletons). */
    private readonly services = new Map<any, any>();

    /** Stores multi-provider arrays. */
    private readonly multiServices = new Map<any, any[]>();

    /** Tokens that cannot be overwritten by subsequent `set()` calls. */
    private readonly sealedTokens = new Set<any>();

    /** Stores provider recipes for transient tokens (re-resolved on every get). */
    private readonly transientRecipes = new Map<any, CliProvider>();

    /**
     * Retrieve a service by its token.
     * Returns `undefined` when no provider is registered for the token.
     * For multi-provider tokens, returns the last registered value (use `getAll` for the full array).
     *
     * @param token The token used to register the service.
     * @returns The resolved service instance, or `undefined` if not registered.
     */
    get<T>(token: any): T | undefined {
        // Transient providers: create a new instance on every call
        if (this.transientRecipes.has(token)) {
            return this.resolveProvider(this.transientRecipes.get(token)!) as T;
        }

        if (this.multiServices.has(token)) {
            const arr = this.multiServices.get(token)!;
            return arr[arr.length - 1] as T;
        }

        if (this.services.has(token)) {
            return this.services.get(token) as T;
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
    getAll<T>(token: any): T[] {
        if (this.multiServices.has(token)) {
            return this.multiServices.get(token) as T[];
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
    getRequired<T>(token: any): T {
        const value = this.get<T>(token);
        if (value === undefined && !this.has(token)) {
            throw new Error(
                `CliServiceContainer: No provider found for token "${this.tokenToString(token)}".`,
            );
        }
        return value as T;
    }

    /**
     * Check whether a service is registered for the given token.
     */
    has(token: any): boolean {
        return this.services.has(token) || this.multiServices.has(token) || this.transientRecipes.has(token);
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
     */
    getRegisteredServiceDetails(): {
        token: string;
        type: string;
        multi: boolean;
    }[] {
        const details: { token: string; type: string; multi: boolean }[] = [];

        for (const [key, value] of this.services.entries()) {
            details.push({
                token: this.tokenToString(key),
                type: this.describeValue(value),
                multi: false,
            });
        }

        for (const [key, provider] of this.transientRecipes.entries()) {
            const className = provider['useClass']?.name ?? provider['useFactory']?.name ?? 'transient';
            details.push({
                token: this.tokenToString(key),
                type: `transient(${className})`,
                multi: false,
            });
        }

        for (const [key, values] of this.multiServices.entries()) {
            details.push({
                token: this.tokenToString(key),
                type: `[${values.map((v: any) => this.describeValue(v)).join(', ')}]`,
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

    /**
     * Register a single provider.
     */
    private registerProvider(provider: CliProvider): void {
        if (
            !provider.multi &&
            this.sealedTokens.has(provider.provide)
        ) {
            throw new Error(
                `CliServiceContainer: Cannot override sealed service "${this.tokenToString(provider.provide)}".`,
            );
        }

        if (provider['transient'] && !provider.multi) {
            // Store the recipe — resolved fresh on every get() call
            this.transientRecipes.set(provider.provide, provider);
            this.services.delete(provider.provide); // clear any previous singleton
        } else {
            const value = this.resolveProvider(provider);

            if (provider.multi) {
                const existing = this.multiServices.get(provider.provide) ?? [];
                existing.push(value);
                this.multiServices.set(provider.provide, existing);
            } else {
                this.services.set(provider.provide, value);
                this.transientRecipes.delete(provider.provide); // clear any previous transient
            }
        }

        if (provider.sealed) {
            this.sealedTokens.add(provider.provide);
        }
    }

    /**
     * Resolve a provider definition to a concrete value.
     *
     * Note: `deps` are resolved eagerly at registration time, so
     * dependency tokens must be registered before the provider that needs them.
     */
    private resolveProvider(provider: CliProvider): any {
        if ('useValue' in provider) {
            return provider.useValue;
        }

        const deps = (provider['deps'] ?? []).map((dep: any) => this.getRequired(dep));

        if ('useFactory' in provider) {
            return provider.useFactory(...deps);
        }

        if ('useClass' in provider) {
            return new provider.useClass(...deps);
        }

        throw new Error(
            'CliServiceContainer: Provider must specify useValue, useFactory, or useClass.',
        );
    }
}

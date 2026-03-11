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
    /** Stores single-value providers (resolved or pending). */
    private readonly services = new Map<any, any>();

    /** Stores multi-provider arrays. */
    private readonly multiServices = new Map<any, any[]>();

    /**
     * Retrieve a service by its token.
     *
     * @param token The token used to register the service.
     * @returns The resolved service instance (or array for multi providers).
     * @throws Error if the token has not been registered.
     */
    get<T>(token: any): T {
        if (this.multiServices.has(token)) {
            return this.multiServices.get(token) as T;
        }

        if (this.services.has(token)) {
            return this.services.get(token) as T;
        }

        const tokenName =
            typeof token === 'string'
                ? token
                : typeof token === 'function'
                  ? token.name
                  : String(token);

        throw new Error(
            `CliServiceContainer: No provider found for token "${tokenName}".`,
        );
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
            tokens.push(
                typeof key === 'string'
                    ? key
                    : typeof key === 'function'
                      ? key.name
                      : String(key),
            );
        }
        for (const key of this.multiServices.keys()) {
            const name =
                typeof key === 'string'
                    ? key
                    : typeof key === 'function'
                      ? key.name
                      : String(key);
            tokens.push(`${name} (multi)`);
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
                token:
                    typeof key === 'string'
                        ? key
                        : typeof key === 'function'
                          ? key.name
                          : String(key),
                type: this.describeValue(value),
                multi: false,
            });
        }

        for (const [key, values] of this.multiServices.entries()) {
            details.push({
                token:
                    typeof key === 'string'
                        ? key
                        : typeof key === 'function'
                          ? key.name
                          : String(key),
                type: `[${values.map((v: any) => this.describeValue(v)).join(', ')}]`,
                multi: true,
            });
        }

        return details;
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
        const value = this.resolveProvider(provider);

        if (provider.multi) {
            const existing = this.multiServices.get(provider.provide) ?? [];
            existing.push(value);
            this.multiServices.set(provider.provide, existing);
        } else {
            this.services.set(provider.provide, value);
        }
    }

    /**
     * Resolve a provider definition to a concrete value.
     */
    private resolveProvider(provider: CliProvider): any {
        if ('useValue' in provider) {
            return provider.useValue;
        }

        if ('useFactory' in provider) {
            return provider.useFactory();
        }

        if ('useClass' in provider) {
            return new provider.useClass();
        }

        throw new Error(
            'CliServiceContainer: Provider must specify useValue, useFactory, or useClass.',
        );
    }
}

/**
 * A DI token that carries the type of the service it identifies, so
 * `services.get(TOKEN)` is typed without a type argument:
 *
 * ```ts
 * export const ITodoStore_TOKEN = createCliToken<ITodoStore>('todo-store');
 * const store = context.services.get(ITodoStore_TOKEN); // ITodoStore | undefined
 * ```
 *
 * At runtime it is the plain string, so it works anywhere a string token does.
 */
export type CliToken<T> = string & { readonly __cliTokenType?: T };

/** Create a typed {@link CliToken}. */
export function createCliToken<T>(name: string): CliToken<T> {
    return name as CliToken<T>;
}

type MultiServices = {
    /**
     * When true, injector returns an array of instances. This is useful to allow multiple
     * providers spread across many files to provide configuration information to a common token.
     */
    multi?: boolean;
};

export type CliValueProvider = MultiServices & {
    useValue: any;
};

export type CliTypeProvider = MultiServices & {
    useClass: any;
    /** DI tokens resolved from the container and passed as constructor arguments. */
    deps?: any[];
};

export type CliFactoryProvider = MultiServices & {
    useFactory: (...args: any[]) => any;
    /** DI tokens resolved from the container and passed as factory arguments. */
    deps?: any[];
};

/**
 * Service registration. `useFactory` and `useClass` providers are created
 * lazily, on the first `get()` of their token (or of a token depending on
 * them), so their `deps` may be registered after them.
 */
export type CliProvider = {
    provide: any;
    /** When true, this token is sealed after registration and cannot be overwritten. */
    sealed?: boolean;
    /** When true, a new instance is created on every `get()` call instead of returning a singleton. */
    transient?: boolean;
} & (
    | CliValueProvider
    | CliTypeProvider
    | CliFactoryProvider
) &
    Record<string, any>;

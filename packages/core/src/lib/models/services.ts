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
    useFactory: Function;
    /** DI tokens resolved from the container and passed as factory arguments. */
    deps?: any[];
};

export type CliProvider = { provide: any } & (
    | CliValueProvider
    | CliTypeProvider
    | CliFactoryProvider
) &
    Record<string, any>;

import { CliEngineSnapshot, ICliCommandProcessor, ICliModule } from '@qodalis/cli-core';
import { CliEngine, CliEngineOptions } from './cli-engine';

/** Service token holding the name of the framework hosting the CLI. */
export const CLI_FRAMEWORK_SERVICE = 'cli-framework';

/** What a framework wrapper passes to an engine: shared by components, providers and config contexts. */
export interface CliHostConfig {
    modules?: ICliModule[];
    /** @deprecated Use modules instead. */
    processors?: ICliCommandProcessor[];
    options?: CliEngineOptions;
    /** Extra services registered by token before start. */
    services?: Record<string, any>;
}

export interface CreateCliEngineConfig extends CliHostConfig {
    /** Reported by `version`, `debug` and `feedback`, e.g. 'React'. */
    framework?: string;
    /** Terminal state to restore on start. */
    snapshot?: CliEngineSnapshot;
}

/**
 * Create an engine for `container` with the services, modules and
 * processors of a wrapper registered (in that order). Call `start()` on it.
 */
export function createCliEngine(container: HTMLElement, config: CreateCliEngineConfig = {}): CliEngine {
    const options: CliEngineOptions | undefined = config.snapshot
        ? { ...(config.options ?? {}), snapshot: config.snapshot }
        : config.options;
    const engine = new CliEngine(container, options);

    if (config.framework) engine.registerService(CLI_FRAMEWORK_SERVICE, config.framework);
    for (const [token, value] of Object.entries(config.services ?? {})) {
        engine.registerService(token, value);
    }
    if (config.modules?.length) engine.registerModules(config.modules);
    if (config.processors?.length) engine.registerProcessors(config.processors);
    return engine;
}

/**
 * Resolve a component's config: each field set locally wins over the one
 * inherited from a surrounding config provider.
 */
export function resolveCliHostConfig(local: CliHostConfig, inherited?: CliHostConfig | null): CliHostConfig {
    return {
        modules: local.modules ?? inherited?.modules,
        processors: local.processors ?? inherited?.processors,
        options: local.options ?? inherited?.options,
        services: local.services ?? inherited?.services,
    };
}

/** Merge option objects key by key: `local` overrides `inherited`. */
export function mergeCliOptions<T extends object>(local: T | undefined, inherited: object | undefined): T | undefined {
    if (!local) return inherited as T | undefined;
    return { ...(inherited ?? {}), ...local } as T;
}

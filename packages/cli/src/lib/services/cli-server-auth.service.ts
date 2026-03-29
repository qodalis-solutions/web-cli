import {
    CliHeadersProvider,
    resolveHeaders,
    ICliServerAuthService,
    ICliServerAuthTokenProvider,
    ICliServerAuthTokenProvider_TOKEN,
    ICliServiceProvider,
} from '@qodalis/cli-core';

/**
 * Default implementation of ICliServerAuthService.
 *
 * Resolves auth headers by merging:
 * 1. Static/dynamic headers from CliServerConfig.headers
 * 2. Headers from all registered ICliServerAuthTokenProvider instances
 *
 * Providers are resolved lazily from the service container on each call,
 * so providers registered after server connection (e.g. during module boot)
 * are picked up automatically.
 */
export class CliServerAuthService implements ICliServerAuthService {
    constructor(private readonly services: ICliServiceProvider) {}

    getHeaders(
        serverName: string,
        configHeaders?: CliHeadersProvider,
    ): Record<string, string> {
        // Start with config-level headers (static or dynamic)
        const merged: Record<string, string> = {
            ...resolveHeaders(configHeaders),
        };

        // Lazily resolve providers — they may be registered after construction
        const providers = this.services.getAll<ICliServerAuthTokenProvider>(
            ICliServerAuthTokenProvider_TOKEN,
        );

        for (const provider of providers) {
            Object.assign(merged, provider.getHeaders(serverName));
        }

        return merged;
    }
}

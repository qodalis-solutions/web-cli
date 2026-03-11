import { Provider } from '@angular/core';
import { ICliPingServerService_TOKEN as CLI_PING_TOKEN } from './cli/tokens';
import { CliDefaultPingServerService } from './cli/services';

/**
 * Angular DI providers for services that the framework-agnostic
 * processors in @qodalis/cli need. The CliComponent bridges these
 * into the engine's service container automatically.
 */
export const resolveCliProviders = (): Provider[] => {
    return [
        {
            useClass: CliDefaultPingServerService,
            provide: CLI_PING_TOKEN,
        },
    ];
};

import { ICliPingServerService } from '@qodalis/cli-core';

export class CliDefaultPingServerService implements ICliPingServerService {
    ping(): Promise<void> {
        // Simulate a server ping
        return new Promise((resolve) => setTimeout(resolve, 2000));
    }
}

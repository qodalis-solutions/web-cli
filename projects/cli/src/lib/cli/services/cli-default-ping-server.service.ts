import { ICliPingServerService } from '../models';

export class CliDefaultPingServerService implements ICliPingServerService {
    ping(): Promise<void> {
        // Simulate a server ping
        return new Promise((resolve) => setTimeout(resolve, 2000));
    }
}

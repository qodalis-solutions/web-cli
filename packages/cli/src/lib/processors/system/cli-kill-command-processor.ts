import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliProcessRegistry,
} from '@qodalis/cli-core';
import { CliProcessRegistry_TOKEN } from '../../services/cli-process-registry';

export class CliKillCommandProcessor implements ICliCommandProcessor {
    command = 'kill';
    description = 'Terminate a running process by PID';
    author = DefaultLibraryAuthor;
    valueRequired = true;
    metadata = { icon: '💀', sealed: true };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        let registry: ICliProcessRegistry;
        try {
            registry = context.services.get<ICliProcessRegistry>(
                CliProcessRegistry_TOKEN,
            );
        } catch {
            context.writer.writeError('Process registry not available');
            return;
        }
        const pidStr = command.value?.trim();
        if (!pidStr) {
            context.writer.writeError('kill: missing PID');
            return;
        }
        const pid = parseInt(pidStr, 10);
        if (isNaN(pid)) {
            context.writer.writeError(`kill: invalid PID: ${pidStr}`);
            return;
        }
        if (registry.kill(pid)) {
            context.writer.writeSuccess(`Killed process ${pid}`);
        } else {
            context.writer.writeError(`kill: no running process with PID ${pid}`);
        }
    }
}

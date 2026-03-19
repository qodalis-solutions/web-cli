import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliProcessRegistry,
} from '@qodalis/cli-core';
import { CliProcessRegistry_TOKEN } from '../../services/cli-process-registry';

export class CliPsCommandProcessor implements ICliCommandProcessor {
    command = 'ps';
    description = 'List running and recent processes';
    author = DefaultLibraryAuthor;
    metadata = { icon: '📋', sealed: true };

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        let registry: ICliProcessRegistry;
        try {
            registry = context.services.get<ICliProcessRegistry>(
                CliProcessRegistry_TOKEN,
            );
        } catch {
            context.writer.writeInfo('Process registry not available');
            return;
        }
        const processes = registry.list();

        if (processes.length === 0) {
            context.writer.writeInfo('No processes');
            return;
        }

        const headers = ['PID', 'NAME', 'TYPE', 'STATUS', 'EXIT', 'TIME', 'COMMAND'];
        const rows = processes.map((p) => {
            const elapsed = `${Math.round((Date.now() - p.startTime) / 1000)}s`;
            return [
                String(p.pid),
                p.name,
                p.type,
                p.status,
                p.exitCode !== undefined ? String(p.exitCode) : '-',
                elapsed,
                p.command,
            ];
        });

        context.writer.writeTable(headers, rows);
    }
}

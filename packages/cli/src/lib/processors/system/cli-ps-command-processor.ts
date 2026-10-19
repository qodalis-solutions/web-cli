import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliProcessRegistry,
    writeExamples,
    writeUsage,
    writeWrapped,
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
            registry = context.services.getRequired<ICliProcessRegistry>(
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

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'List the processes of this terminal: commands, background services, daemons and jobs. Running ones are shown together with recently finished, failed and killed ones (the last 50), with their exit code and how long ago they started.',
        );
        context.writer.writeln();
        writeUsage(context, [['ps', 'All processes, oldest first']]);
        context.writer.writeln();
        writeExamples(context, [
            ['ps', 'What is running now'],
            ['kill 12', 'Stop process 12 from the PID column'],
        ]);
    }
}

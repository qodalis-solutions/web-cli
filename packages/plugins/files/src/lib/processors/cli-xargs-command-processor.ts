import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliXargsCommandProcessor implements ICliCommandProcessor {
    command = 'xargs';
    description = 'Build and execute commands from file input';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '⚡', module: 'file management' };

    parameters = [
        {
            name: 'replace',
            aliases: ['I'],
            description: 'Replace string in command template (e.g., -I {})',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'max-args',
            aliases: ['n'],
            description: 'Maximum number of arguments per command',
            required: false,
            type: 'number' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const replaceStr =
            command.args['replace'] || command.args['I'] || null;
        const maxArgs = parseInt(
            command.args['max-args'] || command.args['n'] || '0',
            10,
        );
        const parsed = this.parseArgs(command);

        if (!parsed.commandTemplate) {
            context.writer.writeError('xargs: missing command');
            return;
        }

        if (!parsed.inputFile) {
            context.writer.writeError('xargs: missing input file');
            return;
        }

        if (!fs.exists(parsed.inputFile)) {
            context.writer.writeError(
                `xargs: ${parsed.inputFile}: No such file or directory`,
            );
            return;
        }

        const content = fs.readFile(parsed.inputFile) || '';
        const args = content
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);

        if (args.length === 0) return;

        const commands: string[] = [];

        if (replaceStr) {
            // Replace mode: one command per arg
            for (const arg of args) {
                const cmd = parsed.commandTemplate.replace(
                    new RegExp(this.escapeRegex(replaceStr), 'g'),
                    arg,
                );
                commands.push(cmd);
            }
        } else if (maxArgs > 0) {
            // Group mode
            for (let i = 0; i < args.length; i += maxArgs) {
                const group = args.slice(i, i + maxArgs);
                commands.push(
                    `${parsed.commandTemplate} ${group.join(' ')}`,
                );
            }
        } else {
            // All args at once
            commands.push(
                `${parsed.commandTemplate} ${args.join(' ')}`,
            );
        }

        // Try to execute via executor, or just output the commands
        const executor = context.executor;
        for (const cmd of commands) {
            if (executor && typeof executor.executeCommand === 'function') {
                try {
                    await executor.executeCommand(cmd, context);
                } catch {
                    context.writer.writeln(cmd);
                }
            } else {
                context.writer.writeln(cmd);
            }
        }
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private parseArgs(command: CliProcessCommand): {
        commandTemplate: string | null;
        inputFile: string | null;
    } {
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        const nonFlagTokens: string[] = [];
        let i = 0;
        while (i < tokens.length) {
            const t = tokens[i];
            if (t === '-I' || t === '--replace') {
                i += 2; // skip flag and its value
            } else if (t === '-n' || t === '--max-args') {
                i += 2; // skip flag and its value
            } else if (t.startsWith('-')) {
                i++;
            } else {
                nonFlagTokens.push(t);
                i++;
            }
        }

        // Last token is input file, rest form the command template
        if (nonFlagTokens.length < 2) {
            return {
                commandTemplate: nonFlagTokens[0] || null,
                inputFile: null,
            };
        }

        const inputFile = nonFlagTokens[nonFlagTokens.length - 1];
        const commandTemplate = nonFlagTokens
            .slice(0, nonFlagTokens.length - 1)
            .join(' ');
        return { commandTemplate, inputFile };
    }
}

import {
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliCommandProcessorRegistry } from '../../services/cli-command-processor-registry';

export class CliAliasCommandProcessor implements ICliCommandProcessor {
    command = 'alias';

    author = DefaultLibraryAuthor;

    description = 'Manage aliases for commands';

    processors?: ICliCommandProcessor[] | undefined;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🔥',
        module: 'misc',
        sealed: true,
        storeName: 'aliases',
    };

    public aliases: Record<string, string> = {};

    constructor() {
        this.processors = [
            {
                command: 'ls',
                description: 'List all aliases',
                processCommand: async (_, context) => {
                    const { writer } = context;

                    writer.writeln('Aliases:');
                    Object.entries(this.aliases).forEach(([alias, command]) => {
                        writer.writeInfo(`  ${alias} -> ${command}`);
                    });

                    if (Object.keys(this.aliases).length === 0) {
                        writer.writeInfo('  No aliases defined');
                    }
                },
            },
        ];
    }

    public async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const registry = context.services.get<CliCommandProcessorRegistry>(
            CliCommandProcessorRegistry,
        );

        const { writer } = context;
        const aliases = Object.keys(command.args);

        if (aliases.length === 0) {
            writer.writeError('No aliases provided');
            context.process.exit(-1);
            return;
        }

        for (const alias of aliases) {
            if (registry.processors.some((p) => p.command === alias)) {
                writer.writeError(
                    `${alias} cannot be aliased to ${command.args[alias]}`,
                );
                context.process.exit(-1);
                return;
            }

            context.writer.writeInfo(`${alias} -> ${command.args[alias]}`);
        }

        context.state.updateState({
            aliases: {
                ...this.aliases,
                ...command.args,
            },
        });

        await context.state.persist();
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select((x) => x['aliases'])
            .subscribe((aliases) => {
                this.aliases = aliases ?? {};
            });
    }
}

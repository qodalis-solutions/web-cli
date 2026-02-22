import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliUnAliasCommandProcessor implements ICliCommandProcessor {
    command = 'unalias';

    author = DefaultLibraryAuthor;

    description = 'Remove aliases for commands';

    valueRequired?: boolean | undefined = true;

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {},
        storeName: 'aliases',
    };

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🔥',
        module: 'misc',
        sealed: true,
    };

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Remove a previously defined command alias');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('unalias <name>', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  unalias h                    ${writer.wrapInColor('# Remove the "h" alias', CliForegroundColor.Green)}`);
        writer.writeln(`  unalias cls                  ${writer.wrapInColor('# Remove the "cls" alias', CliForegroundColor.Green)}`);
    }

    public async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;

        const aliasToRemove = command.value!;

        const { aliases } = context.state.getState();

        if (!aliases[aliasToRemove]) {
            writer.writeError(`Alias ${aliasToRemove} not found`);
            context.process.exit(-1);
            return;
        }

        const updated: Record<string, any> = {};

        Object.keys(aliases)
            .filter((alias) => alias !== aliasToRemove)
            .forEach((alias) => {
                updated[alias] = aliases[alias];
            });

        context.state.updateState({
            aliases: updated,
        });

        await context.state.persist();
    }
}

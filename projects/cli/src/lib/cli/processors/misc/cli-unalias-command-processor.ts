import {
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

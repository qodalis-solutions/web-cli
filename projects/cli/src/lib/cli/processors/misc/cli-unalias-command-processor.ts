import {
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliUnAliasCommandProcessor implements ICliCommandProcessor {
    command = 'unalias';

    author = DefaultLibraryAuthor;

    description = 'Remove aliases for commands';

    valueRequired?: boolean | undefined = true;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🔥',
        module: 'misc',
        sealed: true,
        storeName: 'aliases',
    };

    private aliases: Record<string, string> = {};

    public async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;

        const aliasToRemove = command.value!;

        if (!this.aliases[aliasToRemove]) {
            writer.writeError(`Alias ${aliasToRemove} not found`);
            context.process.exit(-1);
            return;
        }

        const updated: Record<string, any> = {};

        Object.keys(this.aliases)
            .filter((alias) => alias !== aliasToRemove)
            .forEach((alias) => {
                updated[alias] = this.aliases[alias];
            });

        context.state.updateState({
            aliases: updated,
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

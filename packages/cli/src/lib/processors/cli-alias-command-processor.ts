import { aliasesFor, aliasOwner, CliAliasState, withAliases } from './alias-scope';
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { Subscription } from 'rxjs';
import { CliProcessorsRegistry_TOKEN } from '../tokens';

export class CliAliasCommandProcessor implements ICliCommandProcessor {
    command = 'alias';

    author = DefaultLibraryAuthor;

    description = 'Manage aliases for commands';

    // `alias ll="ls -la"`: the definitions are positional arguments, so
    // `alias ls` is handled here rather than as a sub-command
    acceptsRawInput = true;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🔥',
        module: 'misc',
        sealed: true,
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            aliases: {},
        },
        storeName: 'aliases',
    };

    /** Shared aliases (used when no auth module is loaded) */
    public userAliases: Record<string, string> = {};

    private aliasState: CliAliasState = {};

    /** Aliases visible to the current principal */
    aliasesFor(context: Pick<ICliExecutionContext, 'services'>): Record<string, string> {
        return aliasesFor(this.aliasState, aliasOwner(context));
    }

    private stateSubscription?: Subscription;

    /** `alias ls`: list the aliases visible to the current principal */
    private listAliases(context: ICliExecutionContext): void {
        const { writer } = context;
        const visible = this.aliasesFor(context);

        writer.writeln('Aliases:');
        Object.entries(visible).forEach(([alias, command]) => {
            writer.writeInfo(`  ${alias} -> ${command}`);
        });

        if (Object.keys(visible).length === 0) {
            writer.writeInfo('  No aliases defined');
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.alias.long_description', 'Create shortcut aliases for frequently used commands'));
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('alias --<name>=<command>', CliForegroundColor.Cyan)}    ${t.t('cli.alias.create_new', 'Create a new alias')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('alias ls', CliForegroundColor.Cyan)}                    ${t.t('cli.alias.list_all', 'List all aliases')}`,
        );
        writer.writeln();
        writer.writeln(`📝 ${t.t('cli.common.examples', 'Examples:')}`);
        writer.writeln(
            `  alias --h=help               ${writer.wrapInColor('# "h" → runs "help"', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  alias --cls=clear             ${writer.wrapInColor('# "cls" → runs "clear"', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  alias ll="ls -la"             ${writer.wrapInColor('# "ll" → runs "ls -la"', CliForegroundColor.Green)}`,
        );
        writer.writeln();
        writer.writeln(
            `💡 ${t.t('cli.alias.remove_hint', 'Use {command} to remove an alias', { command: 'unalias <name>' })}`,
        );
    }

    public async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const registry = context.services.getRequired<ICliCommandProcessorRegistry>(
            CliProcessorsRegistry_TOKEN,
        );

        const { writer } = context;
        const positionals = command.positionals ?? [];
        if (
            positionals.length === 1 &&
            positionals[0].toLowerCase() === 'ls' &&
            Object.keys(command.args).length === 0
        ) {
            this.listAliases(context);
            return;
        }

        // `alias --ll="ls -la"` (flags) and `alias ll="ls -la"` (positionals)
        const definitions: Record<string, string> = { ...command.args };
        for (const word of positionals) {
            const eq = word.indexOf('=');
            if (eq > 0) definitions[word.slice(0, eq)] = word.slice(eq + 1);
        }
        const aliases = Object.keys(definitions);

        if (aliases.length === 0) {
            writer.writeError('No aliases provided');
            context.process.exit(-1);
            return;
        }

        for (const alias of aliases) {
            if (registry.processors.some((p) => p.command === alias)) {
                writer.writeError(
                    `${alias} cannot be aliased to ${definitions[alias]}`,
                );
                context.process.exit(-1);
                return;
            }

            context.writer.writeInfo(`${alias} -> ${definitions[alias]}`);
        }

        // From the latest saved aliases (another tab may have changed them)
        const owner = aliasOwner(context);
        await context.state.update((saved) =>
            withAliases(saved as CliAliasState, owner, {
                ...aliasesFor(saved as CliAliasState, owner),
                ...definitions,
            }),
        );
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.stateSubscription?.unsubscribe();
        this.stateSubscription = context.state
            .select((x) => x)
            .subscribe((state) => {
                this.aliasState = (state ?? {}) as CliAliasState;
                this.userAliases = this.aliasState.aliases ?? {};
            });
    }
}

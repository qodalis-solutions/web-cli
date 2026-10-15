import {
    CliForegroundColor,
    CliProcessCommand,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import {
    CliEnvironment,
    CliEnvironmentSnapshot,
    ICliEnvironment,
    ICliEnvironment_TOKEN,
} from '../services/cli-environment';

interface EnvironmentState {
    profiles: CliEnvironmentSnapshot;
}

/** `NAME=value` pairs; values may be quoted to hold spaces. */
const ASSIGNMENT = /([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|\S*)/y;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parse `A=1 B="two words" C` into assignments; bare names have no value. */
export function parseAssignments(raw: string): { name: string; value?: string }[] | null {
    const result: { name: string; value?: string }[] = [];
    for (const token of raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []) {
        ASSIGNMENT.lastIndex = 0;
        const match = ASSIGNMENT.exec(token);
        if (match && ASSIGNMENT.lastIndex === token.length) {
            const quoted = /^(["']).*\1$/.test(match[2]);
            result.push({ name: match[1], value: quoted ? match[2].slice(1, -1) : match[2] });
        } else if (NAME.test(token)) {
            result.push({ name: token });
        } else {
            return null;
        }
    }
    return result;
}

/**
 * `export` — set environment variables.
 *
 * Usage:
 *   export VAR=value
 *   export VAR="value with spaces" OTHER=1
 *
 * Changes are saved per user and restored on the next visit.
 */
export class CliExportCommandProcessor implements ICliCommandProcessor {
    command = 'export';
    description = 'Set environment variables';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    metadata = { icon: '📦', module: 'system' };

    stateConfiguration: CliStateConfiguration = {
        storeName: 'environment',
        initialState: { profiles: {} } as EnvironmentState,
    };

    /** Restore saved variables and save every later change (export, unset, VAR=value). */
    async initialize(context: ICliExecutionContext): Promise<void> {
        const env = context.services.get<ICliEnvironment>(ICliEnvironment_TOKEN);
        if (!(env instanceof CliEnvironment)) return;
        const store = context.state;
        env.load(store.getState<EnvironmentState>()?.profiles);
        env.onChange = (profiles) => {
            store.updateState({ profiles } as EnvironmentState);
            void store.persist();
        };
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const env = context.services.getRequired<ICliEnvironment>(
            ICliEnvironment_TOKEN,
        );

        const raw = (command.value || '').trim();
        if (!raw) {
            // `export` with no args — show all variables (like bash)
            const vars = env.getAll();
            const keys = Object.keys(vars).sort();
            for (const key of keys) {
                context.writer.writeln(
                    `declare -x ${key}="${vars[key]}"`,
                );
            }
            return;
        }

        // Parse VAR=value (possibly multiple); a bare VAR keeps its value or becomes empty
        const assignments = parseAssignments(raw);
        if (!assignments?.length) {
            context.writer.writeError(
                `export: invalid syntax: ${raw}`,
            );
            context.process.exit(1, { silent: true });
            return;
        }

        for (const { name, value } of assignments) {
            if (value !== undefined) {
                env.set(name, value);
            } else if (!env.has(name)) {
                env.set(name, '');
            }
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.export.long_description', 'Set or display environment variables'));
        writer.writeln();
        writer.writeln(t.t('cli.common.usage', 'Usage:'));
        writer.writeln(
            `  ${writer.wrapInColor('export', CliForegroundColor.Cyan)}                    ${t.t('cli.export.show_all', 'Show all variables')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('export VAR=value', CliForegroundColor.Cyan)}          ${t.t('cli.export.set_var', 'Set a variable')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('export VAR="hello world"', CliForegroundColor.Cyan)}  ${t.t('cli.export.set_spaces', 'Set with spaces')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('export A=1 B=2', CliForegroundColor.Cyan)}            ${t.t('cli.export.set_many', 'Set several at once')}`,
        );
        writer.writeln();
        writer.writeln(
            t.t('cli.export.saved', 'Variables are saved for the signed-in user and used as $VAR or ${VAR} in commands.'),
        );
    }
}

/**
 * `unset` — remove environment variables.
 */
export class CliUnsetCommandProcessor implements ICliCommandProcessor {
    command = 'unset';
    description = 'Remove environment variables';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    metadata = { icon: '🗑️', module: 'system' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const env = context.services.getRequired<ICliEnvironment>(
            ICliEnvironment_TOKEN,
        );

        const names = (command.value || '').trim().split(/\s+/).filter(Boolean);
        if (!names.length) {
            context.writer.writeError('unset: missing variable name');
            context.process.exit(1, { silent: true });
            return;
        }

        for (const name of names) {
            // Unknown names succeed silently, like bash
            if (env.has(name)) env.unset(name);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.unset.long_description', 'Remove an environment variable'));
        writer.writeln();
        writer.writeln(t.t('cli.common.usage', 'Usage:'));
        writer.writeln(
            `  ${writer.wrapInColor('unset VAR [VAR...]', CliForegroundColor.Cyan)}`,
        );
    }
}

/**
 * `env` / `printenv` — display environment variables.
 */
export class CliEnvCommandProcessor implements ICliCommandProcessor {
    command = 'env';
    aliases = ['printenv'];
    description = 'Display environment variables';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    metadata = { icon: '🌍', module: 'system' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const env = context.services.getRequired<ICliEnvironment>(
            ICliEnvironment_TOKEN,
        );

        const varName = (command.value || '').trim();

        if (varName) {
            // printenv VAR — show single variable
            const val = env.get(varName);
            if (val !== undefined) {
                context.writer.writeln(val);
                context.process.output(val);
            } else {
                context.process.exit(1, { silent: true });
            }
            return;
        }

        // Show all variables
        const vars = env.getAll();
        const keys = Object.keys(vars).sort();
        const lines: string[] = [];
        for (const key of keys) {
            lines.push(`${key}=${vars[key]}`);
        }
        context.writer.writeln(lines.join('\n'));
        context.process.output(lines.join('\n'));
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.env.long_description', 'Display environment variables'));
        writer.writeln();
        writer.writeln(t.t('cli.common.usage', 'Usage:'));
        writer.writeln(
            `  ${writer.wrapInColor('env', CliForegroundColor.Cyan)}           ${t.t('cli.env.show_all', 'Show all variables')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('printenv VAR', CliForegroundColor.Cyan)}   ${t.t('cli.env.show_single', 'Show single variable')}`,
        );
    }
}

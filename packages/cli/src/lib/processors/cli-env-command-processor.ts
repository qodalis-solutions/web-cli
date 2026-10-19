import {
    CliForegroundColor,
    CliProcessCommand,
    CliStateConfiguration,
    cliAuthorize,
    DefaultLibraryAuthor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import {
    applyEnvironmentChange,
    CliEnvironment,
    CliEnvironmentScope,
    CliEnvironmentSnapshot,
    ICliEnvironment,
    ICliEnvironment_TOKEN,
} from '../services/cli-environment';

interface EnvironmentState {
    /** Each user's own variables ('' when signed out). */
    profiles: CliEnvironmentSnapshot;
    /** Shared variables (`export --global`). */
    global?: Record<string, string>;
}

/** Permission to change shared variables, when an auth module is loaded. */
export const CLI_ENV_GLOBAL_PERMISSION = 'system:env:global';

const GLOBAL_PARAMETER: ICliCommandParameterDescriptor = {
    name: 'global',
    aliases: ['g'],
    description: `Shared by every user (needs ${CLI_ENV_GLOBAL_PERMISSION} with the users plugin)`,
    required: false,
    type: 'boolean',
};

/** The scope `--global` selects, or undefined (and an error) when not allowed. */
function savedScope(
    command: CliProcessCommand,
    context: ICliExecutionContext,
    name: string,
): CliEnvironmentScope | undefined {
    if (!command.args['global']) return 'user';
    if (!cliAuthorize(context, CLI_ENV_GLOBAL_PERMISSION)) {
        context.writer.writeError(
            `${name}: permission denied: shared variables need the ${CLI_ENV_GLOBAL_PERMISSION} permission`,
        );
        context.process.exit(1, { silent: true });
        return undefined;
    }
    return 'global';
}

const SOURCE_LABEL: Record<string, string> = {
    session: 'this terminal',
    user: 'user',
    global: 'shared',
    builtin: 'built-in',
};

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
 * Variables are saved for the signed-in user (`--global`: for everyone) and
 * restored on the next visit. `NAME=value` alone is for this terminal only.
 */
export class CliExportCommandProcessor implements ICliCommandProcessor {
    command = 'export';
    description = 'Set environment variables';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    metadata = { icon: '📦', module: 'system' };

    parameters = [GLOBAL_PARAMETER];

    stateConfiguration: CliStateConfiguration = {
        storeName: 'environment',
        initialState: { profiles: {}, global: {} } as EnvironmentState,
    };

    /**
     * Restore saved variables, save every later change (export, unset) and
     * follow changes saved in other tabs and terminals.
     */
    async initialize(context: ICliExecutionContext): Promise<void> {
        const env = context.services.get<ICliEnvironment>(ICliEnvironment_TOKEN);
        if (!(env instanceof CliEnvironment)) return;
        const store = context.state;
        const apply = (state: EnvironmentState | undefined) =>
            env.load(state?.profiles, state?.global);
        apply(store.getState<EnvironmentState>());
        // Each change is applied to the latest saved state, under the cross-tab
        // lock: two tabs (or two users) changing variables keep both changes
        env.onChange = (change) => {
            void store.update((state) =>
                applyEnvironmentChange(state as EnvironmentState, change),
            );
        };
        store.subscribe((state) => apply(state as EnvironmentState));
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
            const keys = Object.keys(vars)
                .filter((key) => !command.args['global'] || env.scopeOf?.(key) === 'global')
                .sort();
            for (const key of keys) {
                context.writer.writeln(
                    `declare -x ${key}="${vars[key]}"`,
                );
            }
            return;
        }

        const scope = savedScope(command, context, 'export');
        if (!scope) return;

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
                env.set(name, value, scope);
            } else if (env.scopeOf?.(name) === 'session' || (scope === 'global' && env.has(name))) {
                // `export NAME` saves the value it has here
                env.set(name, env.get(name)!, scope);
            } else if (!env.has(name)) {
                env.set(name, '', scope);
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
        writer.writeln(
            `  ${writer.wrapInColor('export --global VAR=value', CliForegroundColor.Cyan)} ${t.t('cli.export.set_global', 'Set for every user')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('VAR=value', CliForegroundColor.Cyan)}                 ${t.t('cli.export.set_session', 'This terminal only, not saved')}`,
        );
        writer.writeln();
        writer.writeln(
            t.t(
                'cli.export.scopes',
                'Use variables as $VAR or ${VAR}. A value set in this terminal wins over your own saved one, which wins over a shared one. env shows where each comes from.',
            ),
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
    parameters = [{ ...GLOBAL_PARAMETER, description: `Remove the shared value (needs ${CLI_ENV_GLOBAL_PERMISSION} with the users plugin)` }];

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

        if (command.args['global']) {
            if (!savedScope(command, context, 'unset')) return;
            for (const name of names) env.unset(name, 'global');
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
            `  ${writer.wrapInColor('unset VAR [VAR...]', CliForegroundColor.Cyan)}            ${t.t('cli.unset.own', 'Remove for this terminal and you (a shared value is hidden for you)')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('unset --global VAR [VAR...]', CliForegroundColor.Cyan)}   ${t.t('cli.unset.global', 'Remove the shared value')}`,
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

        // Show all variables, each with where it comes from (dimmed; piped
        // output is plain NAME=value lines)
        const vars = env.getAll();
        const keys = Object.keys(vars).sort();
        const lines: string[] = [];
        for (const key of keys) {
            const line = `${key}=${vars[key]}`;
            lines.push(line);
            const source = env.scopeOf?.(key);
            context.writer.writeln(
                source ? `${line}  \x1b[2m# ${SOURCE_LABEL[source]}\x1b[0m` : line,
            );
        }
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

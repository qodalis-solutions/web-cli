import {
    CliForegroundColor,
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import {
    ICliEnvironment,
    ICliEnvironment_TOKEN,
} from '../services/cli-environment';

/**
 * `export` — set environment variables.
 *
 * Usage:
 *   export VAR=value
 *   export VAR="value with spaces"
 */
export class CliExportCommandProcessor implements ICliCommandProcessor {
    command = 'export';
    description = 'Set environment variables';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    metadata = { icon: '📦', module: 'system' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const env = context.services.get<ICliEnvironment>(
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

        // Parse VAR=value (possibly multiple)
        const match = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) {
            context.writer.writeError(
                `export: invalid syntax: ${raw}`,
            );
            context.process.exit(1, { silent: true });
            return;
        }

        const varName = match[1];
        let varValue = match[2];

        // Strip surrounding quotes
        if (
            (varValue.startsWith('"') && varValue.endsWith('"')) ||
            (varValue.startsWith("'") && varValue.endsWith("'"))
        ) {
            varValue = varValue.slice(1, -1);
        }

        env.set(varName, varValue);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Set or display environment variables');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('export', CliForegroundColor.Cyan)}                    Show all variables`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('export VAR=value', CliForegroundColor.Cyan)}          Set a variable`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('export VAR="hello world"', CliForegroundColor.Cyan)}  Set with spaces`,
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
        const env = context.services.get<ICliEnvironment>(
            ICliEnvironment_TOKEN,
        );

        const varName = (command.value || '').trim();
        if (!varName) {
            context.writer.writeError('unset: missing variable name');
            context.process.exit(1, { silent: true });
            return;
        }

        if (!env.has(varName)) {
            // Silently succeed like bash
            return;
        }

        env.unset(varName);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Remove an environment variable');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('unset VAR', CliForegroundColor.Cyan)}`,
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
        const env = context.services.get<ICliEnvironment>(
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
        const { writer } = context;
        writer.writeln('Display environment variables');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('env', CliForegroundColor.Cyan)}           Show all variables`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('printenv VAR', CliForegroundColor.Cyan)}   Show single variable`,
        );
    }
}

import {
    CliProcessCommand,
    CliForegroundColor,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

/**
 * Execute a script file containing CLI commands.
 *
 * Supported syntax inside scripts:
 *   - One command per line (pipes, operators, redirects all work)
 *   - `# comment` lines and blank lines are ignored
 *   - `set -e` (default) — stop on first error
 *   - `set +e` — continue on errors
 *   - `VAR=value` — variable assignment (script-scoped)
 *   - `$VAR` / `${VAR}` — variable substitution
 */
export class CliShCommandProcessor implements ICliCommandProcessor {
    command = 'sh';
    aliases = ['source', '.'];
    description = 'Execute a script file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '📜', module: 'file management' };

    parameters = [
        {
            name: 'e',
            aliases: ['stop-on-error'],
            description: 'Stop execution on first error (default)',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        let filePath = (command.value || '').trim();

        // When invoked via alias (source, .), getRightOfWord fails to extract
        // the value because it looks for 'sh' in the command string. Fall back
        // to parsing the raw command.
        if (!filePath && command.rawCommand) {
            const raw = command.rawCommand.trim();
            const firstSpace = raw.indexOf(' ');
            if (firstSpace > -1) {
                filePath = raw.slice(firstSpace + 1).trim();
            }
        }

        if (!filePath) {
            context.writer.writeError('sh: missing file operand');
            context.process.exit(1, { silent: true });
            return;
        }

        const resolved = fs.resolvePath(filePath);
        const node = fs.getNode(resolved);

        if (!node) {
            context.writer.writeError(
                `sh: ${filePath}: No such file or directory`,
            );
            context.process.exit(1, { silent: true });
            return;
        }

        if (node.type !== 'file') {
            context.writer.writeError(
                `sh: ${filePath}: Is a directory`,
            );
            context.process.exit(1, { silent: true });
            return;
        }

        const content = fs.readFile(resolved);
        if (content === null || content === undefined) {
            context.writer.writeError(
                `sh: ${filePath}: Cannot read file`,
            );
            context.process.exit(1, { silent: true });
            return;
        }

        await executeScript(content, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('sh <script.sh>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('source <script.sh>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('. <script.sh>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('./script.sh', CliForegroundColor.Cyan)}     (requires execute permission)`,
        );
        writer.writeln();
        writer.writeln('Script syntax:');
        writer.writeln('  # Lines starting with # are comments');
        writer.writeln('  VAR=value          # Variable assignment');
        writer.writeln('  echo $VAR          # Variable substitution');
        writer.writeln('  set -e             # Stop on error (default)');
        writer.writeln('  set +e             # Continue on errors');
        writer.writeln();
        writer.writeln('Example script:');
        writer.writeln(
            writer.wrapInColor(
                '  #!/bin/sh\n' +
                '  # Setup script\n' +
                '  NAME=world\n' +
                '  echo Hello $NAME\n' +
                '  mkdir -p /tmp/test\n' +
                '  echo done > /tmp/test/status.txt',
                CliForegroundColor.Green,
            ),
        );
    }
}

/**
 * Parse and execute script content line by line.
 *
 * Exported so the executor can reuse it for `./script.sh` execution.
 */
export async function executeScript(
    content: string,
    context: ICliExecutionContext,
): Promise<void> {
    const lines = content.split('\n');
    const variables: Record<string, string> = {};
    let stopOnError = true;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        // Skip empty lines and comments
        if (!line || line.startsWith('#')) {
            continue;
        }

        // Handle set -e / set +e
        if (line === 'set -e') {
            stopOnError = true;
            continue;
        }
        if (line === 'set +e') {
            stopOnError = false;
            continue;
        }

        // Variable assignment: VAR=value (no spaces around =)
        const assignMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (assignMatch) {
            const varName = assignMatch[1];
            let varValue = assignMatch[2];
            // Strip surrounding quotes
            if (
                (varValue.startsWith('"') && varValue.endsWith('"')) ||
                (varValue.startsWith("'") && varValue.endsWith("'"))
            ) {
                varValue = varValue.slice(1, -1);
            }
            // Substitute variables in the value itself
            varValue = substituteVariables(varValue, variables);
            variables[varName] = varValue;
            continue;
        }

        // Substitute variables in the command line
        const expanded = substituteVariables(line, variables);

        // Execute the command
        await context.executor.executeCommand(expanded, context);

        const exitCode = context.process.exitCode;
        if (stopOnError && exitCode !== undefined && exitCode !== 0) {
            context.writer.writeError(
                `sh: script aborted at line: ${line}`,
            );
            return;
        }
    }
}

/**
 * Replace `$VAR` and `${VAR}` with values from the variables map.
 * Undefined variables expand to empty string.
 */
function substituteVariables(
    input: string,
    variables: Record<string, string>,
): string {
    // ${VAR} form
    let result = input.replace(
        /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
        (_, name) => variables[name] ?? '',
    );
    // $VAR form (must not be followed by { which was already handled)
    result = result.replace(
        /\$([A-Za-z_][A-Za-z0-9_]*)/g,
        (_, name) => variables[name] ?? '',
    );
    return result;
}

import {
    CliProcessCommand,
    CliForegroundColor,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';
import { splitArgs } from '../utils/split-args';

/**
 * Execute a script file containing CLI commands.
 *
 * Scripts run through the engine's shell runner (`@qodalis/cli`
 * `runScript`): commands, `;`, comments, `set -e`/`set +e`, `VAR=value`,
 * `if`/`elif`/`else`/`fi`, `for`/`while`/`until` loops, `break`/`continue`,
 * `exit`, and `test`/`[ ]` conditions.
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

        let words = splitArgs(command.value || '');

        // When invoked via alias (source, .), getRightOfWord fails to extract
        // the value because it looks for 'sh' in the command string. Fall back
        // to parsing the raw command (flags are not file names).
        if (words.length === 0 && command.rawCommand) {
            words = splitArgs(command.rawCommand)
                .slice(1)
                .filter((w) => !w.startsWith('-'));
        }
        const filePath = words[0] ?? '';

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
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.sh.description', this.description));
        writer.writeln();
        writer.writeln(t.t('cli.common.usage', 'Usage:'));
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
            `  ${writer.wrapInColor('./script.sh', CliForegroundColor.Cyan)}     ${t.t('cli.sh.help.requires_execute', '(requires execute permission)')}`,
        );
        writer.writeln();
        writer.writeln(t.t('cli.sh.help.script_syntax', 'Script syntax:'));
        writer.writeln(`  # ${t.t('cli.sh.help.comments', 'Lines starting with # are comments')}`);
        writer.writeln(`  cmd1; cmd2         # ${t.t('cli.sh.help.several_commands', 'Several commands on one line')}`);
        writer.writeln(`  VAR=value          # ${t.t('cli.sh.help.assignment', 'Variable assignment')}`);
        writer.writeln(`  echo $VAR          # ${t.t('cli.sh.help.substitution', 'Variable substitution')}`);
        writer.writeln(`  set -e             # ${t.t('cli.sh.help.stop_on_error', 'Stop on error (default)')}`);
        writer.writeln(`  set +e             # ${t.t('cli.sh.help.continue_on_errors', 'Continue on errors')}`);
        writer.writeln(`  exit [n]           # ${t.t('cli.sh.help.exit', 'Stop the script with status n')}`);
        writer.writeln();
        writer.writeln(t.t('cli.sh.help.control_flow', 'Control flow:'));
        writer.writeln('  if cmd; then ...; elif cmd; then ...; else ...; fi');
        writer.writeln('  for NAME in a b *.txt; do ...; done');
        writer.writeln(`  while cmd; do ...; done      ${t.t('cli.sh.help.until', '(until cmd: the opposite)')}`);
        writer.writeln(`  break / continue [n]         # ${t.t('cli.sh.help.break_continue', 'Leave / skip in a loop')}`);
        writer.writeln(`  ! cmd                        # ${t.t('cli.sh.help.negate', 'Negate the exit status')}`);
        writer.writeln(
            `  ${t.t('cli.sh.help.conditions', 'Conditions are commands:')} ${writer.wrapInColor('[ -f file ]', CliForegroundColor.Cyan)}, ${writer.wrapInColor('test "$A" = b', CliForegroundColor.Cyan)}, ${writer.wrapInColor('true', CliForegroundColor.Cyan)}, ${writer.wrapInColor('grep x file', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(`  ${t.t('cli.sh.help.conditions_status', '(status 0 = true; see help test). Loops stop after 10000 iterations')}`);
        writer.writeln(`  ${t.t('cli.sh.help.conditions_loops', 'of while/until; Ctrl+C stops the script.')}`);
        writer.writeln();
        writer.writeln(t.t('cli.sh.help.example_script', 'Example script:'));
        writer.writeln(
            writer.wrapInColor(
                '  #!/bin/sh\n' +
                '  # Setup script\n' +
                '  NAME=world\n' +
                '  echo Hello $NAME\n' +
                '  mkdir -p /tmp/test\n' +
                '  for f in a b c; do\n' +
                '      echo $f > /tmp/test/$f.txt\n' +
                '  done\n' +
                '  if [ -f /tmp/test/a.txt ]; then\n' +
                '      echo done > /tmp/test/status.txt\n' +
                '  fi',
                CliForegroundColor.Green,
            ),
        );
    }
}

/** The script runner `@qodalis/cli` provides as a service. */
interface CliScriptRunner {
    run(
        content: string,
        context: ICliExecutionContext,
        options?: { name?: string },
    ): Promise<number>;
}

const SCRIPT_RUNNER_TOKEN = 'cli-script-runner';

/**
 * Execute script content with the engine's shell runner (control flow,
 * variables, `set -e`), the same one used for `./script.sh`.
 */
export async function executeScript(
    content: string,
    context: ICliExecutionContext,
): Promise<void> {
    const runner = context.services.get<CliScriptRunner>(SCRIPT_RUNNER_TOKEN);
    if (!runner) {
        context.writer.writeError('sh: script runner not available (update @qodalis/cli)');
        context.process.exit(1, { silent: true });
        return;
    }
    await runner.run(content, context, { name: 'sh' });
}

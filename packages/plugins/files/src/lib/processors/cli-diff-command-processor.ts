import {
    CliProcessCommand,
    CliForegroundColor,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliDiffCommandProcessor implements ICliCommandProcessor {
    command = 'diff';
    description = 'Compare files line by line';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📝', module: 'file management' };

    parameters = [
        {
            name: 'unified',
            aliases: ['u'],
            description: 'Output in unified format',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'ignore-case',
            aliases: ['i'],
            description: 'Ignore case differences',
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
        const unified = command.args['unified'] || command.args['u'] || false;
        const ignoreCase =
            command.args['ignore-case'] || command.args['i'] || false;
        const paths = this.parsePaths(command);

        if (paths.length < 2) {
            context.writer.writeError('diff: missing operand');
            return;
        }

        const file1 = paths[0];
        const file2 = paths[1];

        if (!fs.exists(file1)) {
            context.writer.writeError(
                `diff: ${file1}: No such file or directory`,
            );
            return;
        }
        if (!fs.exists(file2)) {
            context.writer.writeError(
                `diff: ${file2}: No such file or directory`,
            );
            return;
        }

        const content1 = fs.readFile(file1) || '';
        const content2 = fs.readFile(file2) || '';

        const lines1 = content1.split('\n');
        const lines2 = content2.split('\n');

        const lcs = this.computeLCS(lines1, lines2, ignoreCase);

        if (unified) {
            this.outputUnified(file1, file2, lines1, lines2, lcs, ignoreCase, context);
        } else {
            this.outputNormal(lines1, lines2, lcs, ignoreCase, context);
        }
    }

    private linesEqual(
        a: string,
        b: string,
        ignoreCase: boolean,
    ): boolean {
        if (ignoreCase) {
            return a.toLowerCase() === b.toLowerCase();
        }
        return a === b;
    }

    private computeLCS(
        lines1: string[],
        lines2: string[],
        ignoreCase: boolean,
    ): string[] {
        const m = lines1.length;
        const n = lines2.length;
        const dp: number[][] = Array.from({ length: m + 1 }, () =>
            new Array(n + 1).fill(0),
        );

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (this.linesEqual(lines1[i - 1], lines2[j - 1], ignoreCase)) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        // Backtrack to find LCS
        const result: string[] = [];
        let i = m;
        let j = n;
        while (i > 0 && j > 0) {
            if (this.linesEqual(lines1[i - 1], lines2[j - 1], ignoreCase)) {
                result.unshift(lines1[i - 1]);
                i--;
                j--;
            } else if (dp[i - 1][j] >= dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }

        return result;
    }

    private outputNormal(
        lines1: string[],
        lines2: string[],
        lcs: string[],
        ignoreCase: boolean,
        context: ICliExecutionContext,
    ): void {
        let i1 = 0;
        let i2 = 0;
        let il = 0;

        while (i1 < lines1.length || i2 < lines2.length) {
            if (
                il < lcs.length &&
                i1 < lines1.length &&
                this.linesEqual(lines1[i1], lcs[il], ignoreCase)
            ) {
                if (i2 < lines2.length && this.linesEqual(lines2[i2], lcs[il], ignoreCase)) {
                    i1++;
                    i2++;
                    il++;
                } else {
                    const line = context.writer.wrapInColor(
                        `> ${lines2[i2]}`,
                        CliForegroundColor.Green,
                    );
                    context.writer.writeln(line);
                    i2++;
                }
            } else if (i1 < lines1.length && (il >= lcs.length || !this.linesEqual(lines1[i1], lcs[il], ignoreCase))) {
                const line = context.writer.wrapInColor(
                    `< ${lines1[i1]}`,
                    CliForegroundColor.Red,
                );
                context.writer.writeln(line);
                i1++;
            } else if (i2 < lines2.length) {
                const line = context.writer.wrapInColor(
                    `> ${lines2[i2]}`,
                    CliForegroundColor.Green,
                );
                context.writer.writeln(line);
                i2++;
            } else {
                break;
            }
        }
    }

    private outputUnified(
        file1: string,
        file2: string,
        lines1: string[],
        lines2: string[],
        lcs: string[],
        ignoreCase: boolean,
        context: ICliExecutionContext,
    ): void {
        // Build diff entries
        const entries: Array<{ type: 'same' | 'remove' | 'add'; line: string }> = [];

        let i1 = 0;
        let i2 = 0;
        let il = 0;

        while (i1 < lines1.length || i2 < lines2.length) {
            if (
                il < lcs.length &&
                i1 < lines1.length &&
                this.linesEqual(lines1[i1], lcs[il], ignoreCase)
            ) {
                if (i2 < lines2.length && this.linesEqual(lines2[i2], lcs[il], ignoreCase)) {
                    entries.push({ type: 'same', line: lines1[i1] });
                    i1++;
                    i2++;
                    il++;
                } else {
                    entries.push({ type: 'add', line: lines2[i2] });
                    i2++;
                }
            } else if (i1 < lines1.length && (il >= lcs.length || !this.linesEqual(lines1[i1], lcs[il], ignoreCase))) {
                entries.push({ type: 'remove', line: lines1[i1] });
                i1++;
            } else if (i2 < lines2.length) {
                entries.push({ type: 'add', line: lines2[i2] });
                i2++;
            } else {
                break;
            }
        }

        // Check if there are any changes
        const hasChanges = entries.some((e) => e.type !== 'same');
        if (!hasChanges) return;

        // Output header
        context.writer.writeln(`--- ${file1}`);
        context.writer.writeln(`+++ ${file2}`);

        // Output hunk header
        context.writer.writeln(
            `@@ -1,${lines1.length} +1,${lines2.length} @@`,
        );

        // Output entries
        for (const entry of entries) {
            if (entry.type === 'same') {
                context.writer.writeln(` ${entry.line}`);
            } else if (entry.type === 'remove') {
                const line = context.writer.wrapInColor(
                    `-${entry.line}`,
                    CliForegroundColor.Red,
                );
                context.writer.writeln(line);
            } else {
                const line = context.writer.wrapInColor(
                    `+${entry.line}`,
                    CliForegroundColor.Green,
                );
                context.writer.writeln(line);
            }
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }
}

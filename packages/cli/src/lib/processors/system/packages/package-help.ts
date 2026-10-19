import {
    CliForegroundColor,
    ICliExecutionContext,
    writeHint,
} from '@qodalis/cli-core';
import { ScriptLoaderService } from '../../../services/script-loader';

// The generic help formatting lives in @qodalis/cli-core (help-format):
// re-exported here for the existing imports
export {
    writeUsage,
    writeExamples,
    writeWrapped,
    writeHint,
} from '@qodalis/cli-core';
export type { CliHelpRow as HelpRow } from '@qodalis/cli-core';

/** Message shown by commands that need at least one installed package. */
export function writeNoPackages(context: ICliExecutionContext): void {
    const t = context.translator;
    context.writer.writeInfo('📦 No packages installed');
    context.writer.writeln();
    writeHint(context, 'pkg add <name>', t.t('cli.pkg.help.install_package_2', 'to install a package'));
}

/** Current download source and its fallbacks. */
export function writeSourceSummary(
    context: ICliExecutionContext,
    loader: ScriptLoaderService,
    current = loader.getCdnSource(),
): void {
    const { writer } = context;
    writer.writeln(
        `🌐 Current source: ${writer.wrapInColor(current, CliForegroundColor.Cyan)}`,
    );
    const fallbacks = loader.getSources().filter((s) => s !== current);
    if (fallbacks.length > 0) {
        writer.writeln(
            `   Fallbacks: ${fallbacks.map((s) => writer.wrapInColor(s, CliForegroundColor.Yellow)).join(', ')}`,
        );
    }
}

/** Every configured source with its kind and URL. */
export function writeSourceList(
    context: ICliExecutionContext,
    loader: ScriptLoaderService,
): void {
    const { writer } = context;
    writer.writeln('🌐 Available sources:');
    const names = loader.getSources();
    const width = Math.max(...names.map((n) => n.length)) + 2;
    for (const name of names) {
        const entry = loader.getSource(name);
        writer.writeln(
            `  ${writer.wrapInColor(name.padEnd(width), CliForegroundColor.Cyan)}${writer.wrapInColor(`[${entry?.kind ?? '?'}]`.padEnd(12), CliForegroundColor.Yellow)}${entry?.url ?? ''}`,
        );
    }
}

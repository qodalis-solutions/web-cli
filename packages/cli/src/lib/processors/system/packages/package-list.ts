import {
    CliForegroundColor,
    ICliExecutionContext,
    writeWrapped,
} from '@qodalis/cli-core';

/** Terminals narrower than this (phones) get one package per block. */
export const NARROW_PACKAGE_LIST_COLS = 60;

/** One package in a `pkg` listing. */
export interface PackageListRow {
    /** Name to show: the short name for the CLI's own packages */
    name: string;
    version?: string;
    /** Colored status (`✅ installed`, `🔄 1.0.0 → 1.1.0`, ...) */
    status?: string;
    /** Plain extra detail, such as the source (`[jsdelivr]`) */
    detail?: string;
    description?: string;
}

/** `guid` for `@qodalis/cli-guid`; other packages keep their full name. */
export function packageDisplayName(name: string, prefix: string): string {
    return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/**
 * Write packages as aligned columns, or, on a narrow terminal, as short
 * blocks (name and status, then version and detail) so nothing wraps in
 * the middle of a column. Descriptions wrap at word boundaries.
 */
export function writePackageList(
    context: ICliExecutionContext,
    rows: readonly PackageListRow[],
): void {
    const { writer } = context;
    const narrow = (context.terminal?.cols ?? 80) < NARROW_PACKAGE_LIST_COLS;
    const nameWidth = Math.max(...rows.map((r) => r.name.length)) + 2;
    const versionWidth =
        Math.max(...rows.map((r) => (r.version ?? '').length)) + 2;
    const detailWidth =
        Math.max(...rows.map((r) => (r.detail ?? '').length)) + 2;
    const version = (text: string) =>
        text ? writer.wrapInColor(text, CliForegroundColor.Green) : '';
    const detail = (text: string) =>
        text ? writer.wrapInColor(text, CliForegroundColor.Blue) : '';

    // Blocks with a description need a gap to tell them apart
    const gap = narrow && rows.some((r) => r.description);
    rows.forEach((row, index) => {
        if (gap && index > 0) writer.writeln();
        if (narrow) {
            // The status goes next to the name; without one, the version does
            const first = row.status ?? version(row.version ?? '');
            writer.writeln(
                `  ${writer.wrapInColor(row.name, CliForegroundColor.Cyan)}${first ? `  ${first}` : ''}`,
            );
            const meta = [
                row.status ? version(row.version ?? '') : '',
                detail(row.detail ?? ''),
            ].filter(Boolean);
            if (meta.length > 0) writer.writeln(`    ${meta.join('  ')}`);
        } else {
            // Status last: its emoji make its width unreliable to pad
            const parts = [
                writer.wrapInColor(
                    row.name.padEnd(nameWidth),
                    CliForegroundColor.Cyan,
                ),
                versionWidth > 2
                    ? version((row.version ?? '').padEnd(versionWidth))
                    : '',
                detailWidth > 2
                    ? detail((row.detail ?? '').padEnd(detailWidth))
                    : '',
                row.status ?? '',
            ];
            writer.writeln(`  ${parts.join('').trimEnd()}`);
        }
        if (row.description) {
            writeWrapped(context, row.description, 4);
        }
    });
}

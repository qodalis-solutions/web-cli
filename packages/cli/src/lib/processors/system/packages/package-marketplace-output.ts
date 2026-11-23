import { CliForegroundColor, ICliExecutionContext } from '@qodalis/cli-core';
import {
    incompatibilityReason,
    MarketplacePlugin,
    MarketplacePluginSummary,
    newestWorkingVersion,
    versionFits,
} from './marketplace';
import { PackageListRow, packageDisplayName } from './package-list';
import { isNewerVersion } from './package-utils';
import { packageArg } from './package-installer';

/** Install state of a package, shared by the marketplace and npm listings. */
export function installStatus(
    context: ICliExecutionContext,
    version: string | null | undefined,
    installedVersion: string | undefined,
    bundled: boolean,
): string {
    const { writer } = context;
    if (bundled) {
        return writer.wrapInColor('✅ built in', CliForegroundColor.Green);
    }
    if (!installedVersion) {
        return writer.wrapInColor(
            '📥 not installed',
            CliForegroundColor.Magenta,
        );
    }
    if (version && isNewerVersion(version, installedVersion)) {
        return writer.wrapInColor(
            `🔄 ${installedVersion} → ${version}`,
            CliForegroundColor.Yellow,
        );
    }
    return writer.wrapInColor('✅ installed', CliForegroundColor.Green);
}

/**
 * Rows for marketplace plugins: name (with ✓ for a verified publisher),
 * the newest version that fits, the category, and the install state or
 * why the plugin does not fit this CLI.
 */
export function marketplaceRows(
    context: ICliExecutionContext,
    plugins: readonly MarketplacePluginSummary[],
    prefix: string,
    installed: Map<string, string>,
    isBundled: (name: string) => boolean,
): PackageListRow[] {
    const { writer } = context;
    return plugins.map((plugin) => {
        const version = plugin.version ?? plugin.latest;
        const status = plugin.compatible
            ? installStatus(
                  context,
                  plugin.version,
                  installed.get(plugin.name),
                  isBundled(plugin.name),
              )
            : writer.wrapInColor(
                  `✖ ${plugin.reason ?? 'does not fit this CLI'}`,
                  CliForegroundColor.Red,
              );
        return {
            name: `${packageDisplayName(plugin.name, prefix)}${plugin.publisher.verified ? ' ✓' : ''}`,
            version: version ? `v${version}` : '',
            detail: `[${plugin.category}]`,
            status,
            description: plugin.description,
        };
    });
}

/** `pkg info` from the marketplace. */
export function writeMarketplaceInfo(
    context: ICliExecutionContext,
    plugin: MarketplacePlugin,
    prefix: string,
    installedVersion: string | undefined,
): void {
    const { writer } = context;
    const label = (text: string) =>
        writer.wrapInColor(text.padEnd(12), CliForegroundColor.Yellow);
    const newest = newestWorkingVersion(plugin);

    writer.writeln(
        `📦 ${writer.wrapInColor(plugin.name, CliForegroundColor.Cyan)}${newest ? ` ${writer.wrapInColor(`v${newest.version}`, CliForegroundColor.Green)}` : ''}`,
    );
    if (plugin.description) writer.writeln(`   ${plugin.description}`);
    writer.writeln();
    writer.writeln(
        `  ${label('Publisher')}${plugin.publisher.name}${plugin.publisher.verified ? writer.wrapInColor(' ✓ verified', CliForegroundColor.Green) : ' (not verified)'}`,
    );
    writer.writeln(`  ${label('Category')}${plugin.category}`);
    if (plugin.tags?.length) {
        writer.writeln(`  ${label('Tags')}${plugin.tags.join(', ')}`);
    }
    if (plugin.license)
        writer.writeln(`  ${label('License')}${plugin.license}`);
    writer.writeln(
        `  ${label('Downloads')}${plugin.downloads.weekly.toLocaleString()} a week`,
    );
    if (installedVersion) {
        writer.writeln(`  ${label('Installed')}${installedVersion}`);
    }
    if (!newest) {
        writer.writeln(
            `  ${label('Fits')}${writer.wrapInColor(`no: ${plugin.reason ?? 'no listed version fits this CLI'}`, CliForegroundColor.Red)}`,
        );
    }

    const links = [
        ['Homepage', plugin.homepage],
        ['Repository', plugin.repository],
        ['npm', `https://www.npmjs.com/package/${plugin.name}`],
    ].filter(([, url]) => !!url) as [string, string][];
    writer.writeln();
    for (const [name, url] of links) {
        writer.writeln(
            `  ${label(name)}${writer.wrapInColor(url, CliForegroundColor.Blue)}`,
        );
    }

    const versions = plugin.versions.slice(0, 10);
    if (versions.length > 0) {
        writer.writeln();
        writer.writeln(
            writer.wrapInColor(
                `Versions (${plugin.versions.length}):`,
                CliForegroundColor.Yellow,
            ),
        );
        const width = Math.max(...versions.map((v) => v.version.length)) + 3;
        for (const v of versions) {
            const fits = versionFits(v);
            const state =
                v.status === 'flagged'
                    ? writer.wrapInColor(
                          `⚠ flagged${v.note ? `: ${v.note}` : ''}`,
                          CliForegroundColor.Red,
                      )
                    : fits
                      ? writer.wrapInColor('✓ fits', CliForegroundColor.Green)
                      : writer.wrapInColor(
                            `✖ ${incompatibilityReason(v)}`,
                            CliForegroundColor.Red,
                        );
            const tags = [
                v.version === installedVersion ? 'installed' : '',
                v.deprecated ? 'deprecated' : '',
            ].filter(Boolean);
            writer.writeln(
                `  ${writer.wrapInColor(`v${v.version}`.padEnd(width), CliForegroundColor.White)}API ${v.apiVersion}  ${state}${tags.length ? `  [${tags.join(', ')}]` : ''}`,
            );
        }
        if (plugin.versions.length > versions.length) {
            writer.writeln(
                `  … ${plugin.versions.length - versions.length} more`,
            );
        }
    }

    if (plugin.serverPackages?.length) {
        writer.writeln();
        writer.writeln(
            writer.wrapInColor('Server packages:', CliForegroundColor.Yellow),
        );
        for (const server of plugin.serverPackages) {
            writer.writeln(
                `  ${server.ecosystem.padEnd(6)} ${writer.wrapInColor(server.install, CliForegroundColor.Cyan)}`,
            );
        }
    }

    if (newest && !installedVersion) {
        writer.writeln();
        writer.writeInfo(
            `💡 Install: ${writer.wrapInColor(`pkg add ${packageArg(plugin, prefix)}`, CliForegroundColor.Cyan)}`,
        );
    }
}

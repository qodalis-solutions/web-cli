import {
    ICliCompletionProvider,
    ICliCompletionContext,
    ICliServiceProvider,
} from '@qodalis/cli-core';
import { CliPackageManagerService } from '../services/cli-package-manager';
import { CliPackageManagerService_TOKEN } from '../tokens';

/**
 * Sub-commands of `pkg` (and alias `packages`) that accept an installed
 * package name as their value argument.
 */
const INSTALLED_PKG_SUBCOMMANDS = new Set([
    'remove',
    'rm',
    'update',
]);

/**
 * Provides tab-completion for installed package names when typing
 * `pkg remove <name>`, `pkg update <name>`, etc.
 *
 * Both full names (`@qodalis/cli-guid`) and short names (`guid`) are
 * offered as candidates so the user can type whichever form they prefer.
 *
 * Priority 50 — checked before command and parameter completion.
 */
export class CliPackageNameCompletionProvider
    implements ICliCompletionProvider
{
    priority = 50;

    private readonly QODALIS_PREFIX = '@qodalis/cli-';

    constructor(private readonly services: ICliServiceProvider) {}

    async getCompletions(context: ICliCompletionContext): Promise<string[]> {
        const { tokens, tokenIndex, token } = context;

        if (tokenIndex < 2 || tokens.length < 2) {
            return [];
        }

        const rootCommand = tokens[0].toLowerCase();
        if (rootCommand !== 'pkg' && rootCommand !== 'packages') {
            return [];
        }

        const subCommand = tokens[1].toLowerCase();
        if (!INSTALLED_PKG_SUBCOMMANDS.has(subCommand)) {
            return [];
        }

        const manager = this.services.get<CliPackageManagerService>(
            CliPackageManagerService_TOKEN,
        );
        if (!manager) {
            return [];
        }

        const packages = await manager.getPackages();
        const lowerPrefix = token.toLowerCase();

        // Collect already-mentioned package names so we don't re-suggest them
        const alreadyMentioned = new Set(
            tokens.slice(2, tokenIndex).map((t) => t.toLowerCase()),
        );

        const results: string[] = [];

        for (const pkg of packages) {
            const fullName = pkg.name;
            const shortName = fullName.startsWith(this.QODALIS_PREFIX)
                ? fullName.slice(this.QODALIS_PREFIX.length)
                : null;

            if (alreadyMentioned.has(fullName.toLowerCase())) continue;
            if (shortName && alreadyMentioned.has(shortName.toLowerCase())) continue;

            if (fullName.toLowerCase().startsWith(lowerPrefix)) {
                results.push(fullName);
            }
            if (shortName && shortName.toLowerCase().startsWith(lowerPrefix)) {
                results.push(shortName);
            }
        }

        return results.sort();
    }
}

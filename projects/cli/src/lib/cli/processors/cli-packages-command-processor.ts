import { Injectable } from '@angular/core';
import { DefaultLibraryAuthor } from '../../constants';
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { ScriptLoaderService } from '../services/script-loader.service';
import { CliPackageManagerService } from '../services/cli-package-manager.service';

@Injectable()
export class CliPackagesCommandProcessor implements ICliCommandProcessor {
    command = 'packages';

    description = 'Manage packages in the cli';

    author = DefaultLibraryAuthor;

    version = '1.0.1';

    processors?: ICliCommandProcessor[] | undefined = [];

    constructor(
        private readonly scriptsLoader: ScriptLoaderService,
        private readonly packagesManager: CliPackageManagerService,
    ) {
        const scope = this;

        this.processors = [
            {
                command: 'ls',
                description: 'List all packages in the cli',
                author: DefaultLibraryAuthor,
                async processCommand(command, context) {
                    const packages = packagesManager.getPackages();

                    context.writer.writeln('Packages:');

                    if (packages.length === 0) {
                        context.writer.writeInfo('No packages installed');
                        context.writer.writeInfo(
                            "Use 'packages add <package>' to add a package",
                        );
                        return;
                    }

                    packages.forEach((pkg) => {
                        context.writer.writeInfo(
                            `- ${pkg.name}@${pkg.version}`,
                        );
                    });
                },
            },
            {
                command: 'add',
                description:
                    'Add a package to the cli, e.g. packages add lodash',
                allowUnlistedCommands: true,
                valueRequired: true,
                async processCommand(command, context) {
                    if (packagesManager.hasPackage(command.value!)) {
                        context.writer.writeInfo(
                            `Package ${command.value!} already installed`,
                        );

                        return;
                    }

                    context.progressBar.show();

                    try {
                        const requestUrl = `https://unpkg.com/${command.value!}`;
                        const response = await scriptsLoader.getScript(
                            requestUrl,
                            {
                                onProgress: (progress) => {
                                    context.progressBar.update(progress);
                                },
                            },
                        );

                        const version = scope.extractVersionFromUnpkg(
                            response.xhr.responseURL,
                        );

                        packagesManager.addPackage({
                            name: command.value!,
                            version: version || 'latest',
                            url: response.xhr.responseURL,
                        });
                        context.progressBar.complete();
                    } catch (e) {
                        context.progressBar.complete();
                        context.writer.writeError(
                            e?.toString() || 'Unknown error',
                        );
                    }
                },
            },
            {
                command: 'remove',
                description: 'Remove a package from the cli',
                allowUnlistedCommands: true,
                valueRequired: true,
                async processCommand(command, context) {
                    context.progressBar.show();

                    try {
                        packagesManager.removePackage(command.value!);
                        context.progressBar.complete();
                    } catch (e) {
                        context.progressBar.complete();
                        context.writer.writeError(
                            e?.toString() || 'Unknown error',
                        );
                    }
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        await context.executor.showHelp(command, context);
    }

    writeDescription?(context: ICliExecutionContext): void {
        context.writer.writeln(this.description);

        context.writer.writeln('  packages ls');
        context.writer.writeln('  packages add <package>');
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        const packages = this.packagesManager.getPackages();

        packages.forEach(async (pkg) => {
            await this.scriptsLoader.injectScript(pkg.url);
        });
    }

    private extractVersionFromUnpkg(url: string): string | null {
        const versionRegex = /@([\d.]+)\//; // Matches "@<version>/"
        const match = url.match(versionRegex);
        return match ? match[1] : null;
    }
}

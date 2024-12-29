import { Injectable } from '@angular/core';
import { DefaultLibraryAuthor } from '../../constants';
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliUmdModule,
    Package,
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
                writeDescription(context) {
                    context.writer.writeln('  packages ls');
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

                        const pkg: Package = {
                            name: command.value!,
                            version: version || 'latest',
                            url: response.xhr.responseURL,
                        };

                        packagesManager.addPackage(pkg);

                        await scope.registerLibraryServices(pkg, context);

                        context.progressBar.complete();
                    } catch (e) {
                        context.progressBar.complete();
                        context.writer.writeError(
                            e?.toString() || 'Unknown error',
                        );
                    }
                },
                writeDescription(context) {
                    context.writer.writeln('  packages add <package>');
                    context.writer.writeln('  packages add @qodalis/cli-guid');
                    context.writer.writeln(
                        '  packages add @qodalis/cli-server-logs',
                    );
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
        this.initializeBrowserEnvironment();

        const packages = this.packagesManager.getPackages();

        packages.forEach(async (pkg) => {
            await this.scriptsLoader.injectScript(pkg.url);

            await this.registerLibraryServices(pkg, context);
        });
    }

    private extractVersionFromUnpkg(url: string): string | null {
        const versionRegex = /@([\d.]+)\//; // Matches "@<version>/"
        const match = url.match(versionRegex);
        return match ? match[1] : null;
    }

    private async registerLibraryServices(
        pkg: Package,
        context: ICliExecutionContext,
    ): Promise<void> {
        setTimeout(() => {
            const global = window as any;

            if (!global[pkg.name]) {
                console.warn(`Package ${pkg.name} not found in global scope`);
                return;
            }

            const module = global[pkg.name] as ICliUmdModule;

            if (!module) {
                console.warn(`Module not found in package ${pkg.name}`);
                return;
            }

            if (module.dependencies && module.dependencies.length > 0) {
                console.info("Injecting module's dependencies");

                module.dependencies.forEach(async (dependency) => {
                    await this.scriptsLoader.injectScript(dependency.url);
                });
            } else {
                console.info(`Module ${pkg.name} has no dependencies`);
            }

            if (module.processors) {
                console.info('Registering processors from module ' + pkg.name);
                module.processors.forEach((processor: ICliCommandProcessor) => {
                    context.executor.registerProcessor(processor);
                });
            } else {
                console.warn(`Module ${pkg.name} has no processors`);
            }
        }, 100);
    }

    private initializeBrowserEnvironment(): void {
        (window as any).core = {
            Injectable: () => {},
        };

        (window as any).angularCli = {
            DefaultLibraryAuthor,
        };
    }
}

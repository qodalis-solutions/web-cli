import { Injectable } from '@angular/core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliUmdModule,
    initializeBrowserEnvironment,
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

                        context.writer.writeSuccess(
                            'Package added successfully',
                        );

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
                        context.writer.writeSuccess(
                            `Package ${command.value!} removed successfully`,
                        );
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
        initializeBrowserEnvironment({
            handlers: [
                async (module: ICliUmdModule) => {
                    await this.registerUmdModule(module, context);
                },
            ],
        });

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

    private async registerUmdModule(
        module: ICliUmdModule,
        context: ICliExecutionContext,
    ): Promise<void> {
        if (!module) {
            return;
        }

        if (module.dependencies && module.dependencies.length > 0) {
            console.info("Injecting module's dependencies");

            module.dependencies.forEach(async (dependency) => {
                await this.scriptsLoader.injectScript(dependency.url);

                if (dependency.globalName) {
                    const isAvailable = await this.waitForGlobal(
                        dependency.globalName,
                        3000,
                    );

                    if (!isAvailable) {
                        console.error(
                            `Dependency ${dependency.globalName} not found in global scope within timeout`,
                        );

                        return;
                    } else {
                        console.info(
                            `Dependency ${dependency.globalName} is available in global scope`,
                        );
                    }
                }
            });
        } else {
            console.info(`Module ${module.name} has no dependencies`);
        }

        if (module.processors) {
            console.info('Registering processors from module ' + module.name);
            module.processors.forEach((processor: ICliCommandProcessor) => {
                context.executor.registerProcessor(processor);
            });
        } else {
            console.warn(`Module ${module.name} has no processors`);
        }
    }

    /**
     * Waits until a global variable is available on the `window` object.
     * @param globalName {string} The name of the global variable to check.
     * @param timeout {number} The maximum time to wait in milliseconds.
     * @returns {Promise<boolean>} Resolves to `true` if the variable is found, `false` otherwise.
     */
    private waitForGlobal(
        globalName: string,
        timeout: number,
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const interval = 50; // Check every 50ms
            let elapsed = 0;

            const check = () => {
                if ((window as any)[globalName]) {
                    resolve(true);
                } else if (elapsed >= timeout) {
                    resolve(false);
                } else {
                    elapsed += interval;
                    setTimeout(check, interval);
                }
            };

            check();
        });
    }
}

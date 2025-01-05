import { Injectable } from '@angular/core';
import {
    CliForegroundColor,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
} from '@qodalis/cli-core';
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliUmdModule,
    initializeBrowserEnvironment,
    Package,
} from '@qodalis/cli-core';
import { ScriptLoaderService } from '../../services/script-loader.service';
import { CliPackageManagerService } from '../../services/cli-package-manager.service';

@Injectable()
export class CliPackagesCommandProcessor implements ICliCommandProcessor {
    readonly command = 'packages';

    description = 'Manage packages in the cli';

    author = DefaultLibraryAuthor;

    readonly version = '1.0.1';

    readonly processors?: ICliCommandProcessor[] | undefined = [];

    readonly metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
    };

    private registeredDependencies: string[] = [];

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
                    const { progressBar, writer } = context;
                    if (packagesManager.hasPackage(command.value!)) {
                        writer.writeInfo(
                            `Package ${command.value!} already installed`,
                        );

                        return;
                    }

                    progressBar.show();
                    progressBar.setText(`Fetching package ${command.value!}`);

                    try {
                        const promises = [
                            scriptsLoader
                                .getScript(
                                    `https://unpkg.com/${command.value!}` +
                                        '/package.json',
                                )
                                .catch((error) => ({
                                    error,
                                    content: null,
                                    xhr: null,
                                }))
                                .finally(() => {
                                    progressBar.update(10, {
                                        type: 'increment',
                                    });
                                }),
                        ];

                        if (
                            !command.value!.startsWith(
                                packagesManager.QODALIS_COMMAND_PREFIX,
                            )
                        ) {
                            promises.push(
                                scriptsLoader
                                    .getScript(
                                        `https://unpkg.com/${packagesManager.QODALIS_COMMAND_PREFIX}${command.value!}` +
                                            '/package.json',
                                    )
                                    .catch((error) => ({
                                        error,
                                        content: null,
                                        xhr: null,
                                    }))
                                    .finally(() => {
                                        progressBar.update(10, {
                                            type: 'increment',
                                        });
                                    }),
                            );
                        }

                        progressBar.update(10);

                        const packages = await Promise.all(promises);

                        if (packages.every((p) => p.error)) {
                            progressBar.setText('Package not found');
                            throw packages[0].error;
                        }

                        const validResponses = packages
                            .filter((p) => p.content)
                            .map((p) => JSON.parse(p.content || '{}'));

                        progressBar.update(20, {
                            type: 'increment',
                        });
                        progressBar.setText("Checking package's dependencies");

                        const packgeInfo = validResponses.some((x) =>
                            x.name.startsWith(
                                packagesManager.QODALIS_COMMAND_PREFIX,
                            ),
                        )
                            ? validResponses.find((x) =>
                                  x.name.startsWith(
                                      packagesManager.QODALIS_COMMAND_PREFIX,
                                  ),
                              )
                            : validResponses[0];

                        const response = await scriptsLoader.getScript(
                            `https://unpkg.com/${packgeInfo.name}`,
                            {
                                onProgress: (progress) => {
                                    context.progressBar.update(progress);
                                },
                            },
                        );

                        progressBar.update(20, {
                            type: 'increment',
                        });
                        progressBar.setText('Injecting package');

                        const pkg: Package = {
                            name: packgeInfo.name,
                            version: packgeInfo.version || 'latest',
                            url: response.xhr.responseURL,
                            dependencies: packgeInfo.cliDependencies || [],
                        };

                        progressBar.update(80);
                        progressBar.setText('Registering dependencies');

                        await scope.registerPackageDependencies(pkg);

                        progressBar.update(90);
                        progressBar.setText('Dependencies registered');

                        if (response.content) {
                            await scope.scriptsLoader.injectBodyScript(
                                response.content,
                            );
                        }

                        progressBar.update(95);
                        progressBar.setText('Saving package');

                        packagesManager.addPackage(pkg);

                        context.progressBar.complete();

                        context.writer.writeSuccess(
                            `Package ${packgeInfo.name}@${packgeInfo.version} added successfully`,
                        );
                    } catch (e) {
                        context.progressBar.complete();
                        context.writer.writeError(
                            e?.toString() || 'Unknown error',
                        );
                    }
                },
                writeDescription(context) {
                    context.writer.writeln(
                        '  packages add <package> ' +
                            context.writer.wrapInColor(
                                '# Add a package',
                                CliForegroundColor.Green,
                            ),
                    );
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
                        const pkg = packagesManager.removePackage(
                            command.value!,
                        );

                        if (pkg) {
                            const module = (window as any)[
                                pkg.name
                            ] as ICliUmdModule;
                            if (module) {
                                module.processors?.forEach((processor) => {
                                    context.executor.unregisterProcessor(
                                        processor,
                                    );
                                });
                            }
                        }

                        context.progressBar.complete();
                        context.writer.writeSuccess(
                            `Package ${pkg.name}@${pkg.version} removed successfully`,
                        );
                    } catch (e) {
                        context.progressBar.complete();
                        context.writer.writeError(
                            e?.toString() || 'Unknown error',
                        );
                    }
                },
            },
            {
                command: 'update',
                description:
                    'Update a package in the cli to the latest version or update all packages',
                allowUnlistedCommands: true,
                valueRequired: false,
                async processCommand(command, context) {
                    if (command.value) {
                        await scope.updatePackage(command.value!, context);
                    } else {
                        const packages = packagesManager.getPackages();
                        for (const pkg of packages) {
                            await scope.updatePackage(pkg.name, context);
                        }

                        context.writer.writeSuccess('All packages updated');
                    }
                },
                writeDescription(context) {
                    context.writer.writeln(
                        '  packages update <package> ' +
                            context.writer.wrapInColor(
                                '# Update a specific package',
                                CliForegroundColor.Green,
                            ),
                    );
                    context.writer.writeln(
                        '  packages update ' +
                            context.writer.wrapInColor(
                                '# Update all packages',
                                CliForegroundColor.Green,
                            ),
                    );
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

        context.writer.writeInfo(
            'Available packages can be found at https://www.npmjs.com/org/qodalis',
        );

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

        for (const pkg of packages) {
            await this.registerPackageDependencies(pkg);

            await this.scriptsLoader.injectScript(pkg.url);
        }
    }

    private async updatePackage(
        name: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { progressBar, writer } = context;

        progressBar.show();

        try {
            progressBar.update(10, {
                type: 'increment',
            });
            progressBar.setText(`Updating package ${name}`);
            const currentPackage = this.packagesManager.getPackage(name);

            if (!currentPackage) {
                progressBar.complete();
                writer.writeError(`Package ${name} not found`);
                return;
            }

            const packageUrl = `https://unpkg.com/${currentPackage.name}`;

            const newPackage = await this.scriptsLoader
                .getScript(packageUrl + '/package.json')
                .then((response) => {
                    return JSON.parse(response.content || '{}');
                });

            progressBar.update(20, {
                type: 'increment',
            });

            progressBar.setText(
                `Checking for updates for package ${currentPackage.name}`,
            );

            if (newPackage.version === currentPackage.version) {
                context.progressBar.complete();
                context.writer.writeInfo(
                    `Package ${currentPackage.name} is already up to date with version ${currentPackage.version}`,
                );
                return;
            }

            const response = await this.scriptsLoader.getScript(packageUrl, {
                onProgress: (progress) => {
                    context.progressBar.update(progress);
                },
            });

            progressBar.update(20, {
                type: 'increment',
            });
            progressBar.setText(`Updating package ${currentPackage.name}`);

            const updatedPkg: Package = {
                name: newPackage.name,
                version: newPackage.version || 'latest',
                url: response.xhr.responseURL,
                dependencies: newPackage.cliDependencies || [],
            };

            await this.registerPackageDependencies(updatedPkg);

            progressBar.update(90);
            progressBar.setText(`Injecting package ${currentPackage.name}`);

            if (response.content) {
                await this.scriptsLoader.injectBodyScript(response.content);
            }

            this.packagesManager.updatePackage(updatedPkg);

            progressBar.setText(
                `Package ${currentPackage.name} updated successfully`,
            );
            progressBar.complete();

            writer.writeSuccess(
                `Package ${currentPackage.name} updated successfully to version ${newPackage.version} from ${currentPackage.version}`,
            );
        } catch (e) {
            progressBar.complete();
            writer.writeError(e?.toString() || 'Unknown error');
        }
    }

    private async registerUmdModule(
        module: ICliUmdModule,
        context: ICliExecutionContext,
    ): Promise<void> {
        if (!module) {
            return;
        }

        if (module.processors) {
            console.info('Registering processors from module ' + module.name);
            for (const processor of module.processors) {
                context.executor.registerProcessor(processor);
                await processor.initialize?.(context);
            }
        } else {
            console.warn(`Module ${module.name} has no processors`);
        }
    }

    private async registerPackageDependencies(pkg: Package): Promise<void> {
        if (pkg.dependencies && pkg.dependencies.length > 0) {
            console.info(`Injecting package ${pkg.name} dependencies`);

            for (const dependency of pkg.dependencies) {
                if (this.registeredDependencies.includes(dependency.name!)) {
                    console.info(
                        `Dependency ${dependency.globalName} already registered`,
                    );
                    continue;
                }

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

                this.registeredDependencies.push(dependency.name);
            }
        } else {
            console.info(`Package ${pkg.name} has no dependencies`);
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

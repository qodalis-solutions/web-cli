import {
    CliModuleRegistry,
    ICliExecutionContext,
    Package,
} from '@qodalis/cli-core';
import { CliPackageInstaller } from '../lib/processors/system/packages/package-installer';
import { ScriptLoaderService } from '../lib/services/script-loader';
import { CliPackageManagerService } from '../lib/services/cli-package-manager';

describe('pkg bundled modules', () => {
    let moduleRegistry: CliModuleRegistry;
    let installed: Package[];
    let manager: jasmine.SpyObj<CliPackageManagerService>;
    let loader: jasmine.SpyObj<ScriptLoaderService>;
    let installer: CliPackageInstaller;
    let context: ICliExecutionContext;
    let writer: jasmine.SpyObj<any>;

    beforeEach(async () => {
        moduleRegistry = new CliModuleRegistry();
        await moduleRegistry.register({
            apiVersion: 2,
            name: '@qodalis/cli-guid',
            version: '2.6.0',
            processors: [],
        });
        moduleRegistry.markBundled(['@qodalis/cli-guid']);

        installed = [];
        manager = jasmine.createSpyObj<CliPackageManagerService>(
            'CliPackageManagerService',
            [
                'getPackages',
                'getPackage',
                'hasPackage',
                'addPackage',
                'removePackage',
            ],
        );
        (manager as any).QODALIS_COMMAND_PREFIX = '@qodalis/cli-';
        manager.getPackages.and.callFake(async () => installed);
        manager.hasPackage.and.callFake(async (name: string) =>
            installed.some((p) => p.name === name),
        );
        manager.removePackage.and.callFake(async (name: string) => {
            const pkg = installed.find((p) => p.name === name)!;
            installed = installed.filter((p) => p !== pkg);
            return pkg;
        });
        loader = jasmine.createSpyObj<ScriptLoaderService>(
            'ScriptLoaderService',
            [
                'getScriptWithFallback',
                'injectBodyScript',
                'injectScriptWithFallback',
                'getSources',
                'getSourceUrl',
            ],
        );

        installer = new CliPackageInstaller(loader, manager);
        installer.attach(
            jasmine.createSpyObj('registry', ['unregisterProcessor']),
            moduleRegistry,
        );

        writer = jasmine.createSpyObj('writer', [
            'writeInfo',
            'writeError',
            'writeSuccess',
            'writeWarning',
            'writeln',
        ]);
        context = {
            writer,
            services: { get: () => undefined },
            progressBar: jasmine.createSpyObj('progressBar', [
                'show',
                'hide',
                'complete',
                'setText',
                'setProgress',
            ]),
            logger: jasmine.createSpyObj('logger', [
                'info',
                'warn',
                'error',
                'debug',
                'log',
            ]),
        } as unknown as ICliExecutionContext;
    });

    it('marks and lists the modules the host provides', () => {
        expect(moduleRegistry.isBundled('@qodalis/cli-guid')).toBeTrue();
        expect(moduleRegistry.isBundled('@qodalis/cli-qr')).toBeFalse();
        expect(moduleRegistry.getBundledNames()).toEqual(['@qodalis/cli-guid']);
    });

    it('resolves short and full names of bundled modules', () => {
        expect(installer.bundledName('guid')).toBe('@qodalis/cli-guid');
        expect(installer.bundledName('@qodalis/cli-guid')).toBe(
            '@qodalis/cli-guid',
        );
        expect(installer.bundledName('qr')).toBeUndefined();
        expect(installer.bundledModules().map((m) => m.version)).toEqual([
            '2.6.0',
        ]);
    });

    it('does not install a bundled module', async () => {
        await installer.install('guid', context);

        expect(writer.writeError).toHaveBeenCalledWith(
            'Package @qodalis/cli-guid is built in and cannot be installed with pkg',
        );
        expect(loader.getScriptWithFallback).not.toHaveBeenCalled();
        expect(manager.addPackage).not.toHaveBeenCalled();
    });

    it('does not update a bundled module', async () => {
        const result = await installer.update('guid', context);

        expect(result).toBe('current');
        expect(manager.getPackage).not.toHaveBeenCalled();
    });

    it('refuses to remove a bundled module that is not installed', async () => {
        await installer.remove('@qodalis/cli-guid', context);

        expect(writer.writeError).toHaveBeenCalledWith(
            'Package @qodalis/cli-guid is built in and cannot be removed',
        );
        expect(moduleRegistry.getModule('@qodalis/cli-guid')).toBeDefined();
    });

    it('removes an installed copy without unloading the app module', async () => {
        installed = [
            { name: '@qodalis/cli-guid', version: '2.5.0' } as Package,
        ];

        await installer.remove('@qodalis/cli-guid', context);

        expect(installed).toEqual([]);
        expect(moduleRegistry.getModule('@qodalis/cli-guid')).toBeDefined();
    });

    it('skips an installed copy of a bundled module at startup', async () => {
        installed = [
            { name: '@qodalis/cli-guid', version: '2.5.0' } as Package,
        ];

        await installer.loadInstalled(context);

        expect(context.logger.info).toHaveBeenCalledWith(
            'Package @qodalis/cli-guid is built in, not loading the installed copy',
        );
        expect(loader.getScriptWithFallback).not.toHaveBeenCalled();
        expect(loader.injectScriptWithFallback).not.toHaveBeenCalled();
    });
});

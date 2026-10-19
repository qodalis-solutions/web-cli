import { Terminal } from '@xterm/xterm';
import {
    CLI_CONFIGURE_STORE_NAME,
    CliBootOptions,
    ICliCompletionProvider,
    ICliCompletionProvider_TOKEN,
} from '@qodalis/cli-core';
import { CliBootLog } from '../services/cli-boot-log';
import { ICliStateStoreManager } from '../state/cli-state-store-manager';
import { CliCommandExecutor } from '../executor/cli-command-executor';
import { CliCommandProcessorRegistry } from '../registry/cli-command-processor-registry';
import { CliServerManager } from '../server/cli-server-manager';
import { CliExecutionContext } from '../context/cli-execution-context';
import { InitializeServicesResult } from './cli-service-initializer';
import { CliCommandCompletionProvider } from '../completion/cli-command-completion-provider';
import { CliParameterCompletionProvider } from '../completion/cli-parameter-completion-provider';
import { CliServiceNameCompletionProvider } from '../completion/cli-service-name-completion-provider';
import { CliPackageNameCompletionProvider } from '../completion/cli-package-name-completion-provider';
import { CliThemeNameCompletionProvider } from '../completion/cli-theme-name-completion-provider';
import { CliAliasNameCompletionProvider } from '../completion/cli-alias-name-completion-provider';
import { CliServerNameCompletionProvider } from '../completion/cli-server-name-completion-provider';
import { CliConfigKeyCompletionProvider } from '../completion/cli-config-key-completion-provider';

/**
 * Create the boot report. It is shown unless turned off by the app
 * (`options.boot.showLogs: false`), by the user
 * (`configure set system.bootLogs false`), or when restoring a snapshot.
 */
export async function createBootLog(
    terminal: Terminal,
    stateStoreManager: ICliStateStoreManager,
    options: {
        boot?: CliBootOptions;
        restoringSnapshot: boolean;
        startedAt: number;
    },
): Promise<CliBootLog> {
    let show = options.boot?.showLogs !== false && !options.restoringSnapshot;

    if (show) {
        try {
            const store = stateStoreManager.getStateStore(
                CLI_CONFIGURE_STORE_NAME,
            );
            await store.initialize();
            const state = store.getState<Record<string, any>>();
            if (state?.['system']?.['bootLogs'] === false) {
                show = false;
            }
        } catch {
            // Settings unavailable: keep the configured default
        }
    }

    return new CliBootLog(terminal, show, {
        slowStepMs: options.boot?.slowStepMs,
        startedAt: options.startedAt,
    });
}

/** Summary line written when boot completes. */
export function bootSummary(
    bootLog: CliBootLog,
    moduleCount: number,
    commandCount: number,
): string {
    return `Ready in ${(bootLog.elapsedMs / 1000).toFixed(2)} s · ${moduleCount} modules · ${commandCount} commands`;
}

/**
 * Tab-completion providers: those registered by plugins first, then the
 * built-in ones.
 */
export function createCompletionProviders(deps: {
    services: InitializeServicesResult['services'];
    registry: CliCommandProcessorRegistry;
    executor: CliCommandExecutor;
    stateStoreManager: InitializeServicesResult['stateStoreManager'];
    serverManager: CliServerManager;
    backgroundServices: CliExecutionContext['backgroundServices'];
}): ICliCompletionProvider[] {
    const {
        services,
        registry,
        executor,
        stateStoreManager,
        serverManager,
        backgroundServices,
    } = deps;

    const builtIn: ICliCompletionProvider[] = [
        new CliServiceNameCompletionProvider(backgroundServices),
        new CliPackageNameCompletionProvider(services),
        new CliThemeNameCompletionProvider(),
        new CliAliasNameCompletionProvider(stateStoreManager),
        new CliServerNameCompletionProvider(serverManager),
        new CliConfigKeyCompletionProvider(registry),
        new CliCommandCompletionProvider(registry),
        new CliParameterCompletionProvider(registry, executor),
    ];

    const fromPlugins = services.getAll<ICliCompletionProvider>(
        ICliCompletionProvider_TOKEN,
    );

    return [...fromPlugins, ...builtIn];
}

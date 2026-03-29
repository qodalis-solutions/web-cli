import {
    CliProvider,
    ICliDragDropService_TOKEN,
    ICliTranslationService_TOKEN,
} from '@qodalis/cli-core';
import { SyntaxHighlighterRegistry } from '../editor/syntax/registry';
import {
    JsonHighlighter,
    HtmlHighlighter,
    MarkdownHighlighter,
    YamlHighlighter,
} from '../editor/syntax/highlighters';
import { CliCommandProcessorRegistry } from '../registry/cli-command-processor-registry';
import { CliServiceContainer } from '../services/cli-service-container';
import { CliLogger } from '../services/cli-logger';
import { CliCommandHistory } from '../services/cli-command-history';
import {
    CliStateStoreManager,
} from '../state/cli-state-store-manager';
import { CliKeyValueStore } from '../storage/cli-key-value-store';
import {
    CliCommandHistory_TOKEN,
    CliKeyValueStore_TOKEN,
    CliProcessorsRegistry_TOKEN,
    CliStateStoreManager_TOKEN,
    ICliPingServerService_TOKEN,
    SyntaxHighlighterRegistry_TOKEN,
} from '../tokens';
import { CliDefaultPingServerService } from '../services/defaults/cli-default-ping-server.service';
import {
    CliEnvironment,
    ICliEnvironment_TOKEN,
} from '../services/cli-environment';
import {
    CliProcessRegistry,
    CliProcessRegistry_TOKEN,
} from '../services/cli-process-registry';
import { CliDragDropService } from '../services/cli-drag-drop.service';
import { CliTranslationService } from '../services/cli-translation-service';

export interface InitializeServicesOptions {
    registry: CliCommandProcessorRegistry;
    pendingServices: CliProvider[];
    dragDropService?: CliDragDropService;
}

export interface InitializeServicesResult {
    services: CliServiceContainer;
    logger: CliLogger;
    commandHistory: CliCommandHistory;
    stateStoreManager: CliStateStoreManager;
    processRegistry: CliProcessRegistry;
    translator: CliTranslationService;
}

/**
 * Build and populate the service container with all core services.
 * Takes the registry, pending (user-registered) services, and the drag-drop
 * service instance, and returns all initialized services ready for wiring
 * into the execution context.
 */
export async function initializeServices(
    options: InitializeServicesOptions,
): Promise<InitializeServicesResult> {
    const { registry, pendingServices, dragDropService } = options;

    // Initialize storage (IndexedDB)
    const store = new CliKeyValueStore();
    await store.initialize();

    // Build service container
    const services = new CliServiceContainer();
    const logger = new CliLogger();
    const commandHistory = new CliCommandHistory(store);
    await commandHistory.initialize();

    services.set([{ provide: CliKeyValueStore_TOKEN, useValue: store, sealed: true }]);

    const stateStoreManager = new CliStateStoreManager(services, registry);
    const processRegistry = new CliProcessRegistry();

    services.set([
        {
            provide: CliStateStoreManager_TOKEN,
            useValue: stateStoreManager,
            sealed: true,
        },
        { provide: CliProcessorsRegistry_TOKEN, useValue: registry, sealed: true },
        { provide: CliCommandHistory_TOKEN, useValue: commandHistory, sealed: true },
        {
            provide: CliProcessRegistry_TOKEN,
            useValue: processRegistry,
            sealed: true,
        },
    ]);

    // Apply pending services registered before start()
    if (pendingServices.length > 0) {
        services.set(pendingServices);
    }

    // Register default services only if not already provided
    const pendingTokens = new Set(pendingServices.map((s) => s.provide));

    if (!pendingTokens.has(ICliPingServerService_TOKEN)) {
        services.set([
            {
                provide: ICliPingServerService_TOKEN,
                useClass: CliDefaultPingServerService,
                sealed: true,
            },
        ]);
    }

    // Register syntax highlighter registry with built-in languages
    const syntaxRegistry = new SyntaxHighlighterRegistry();
    syntaxRegistry.register(new JsonHighlighter());
    syntaxRegistry.register(new HtmlHighlighter());
    syntaxRegistry.register(new MarkdownHighlighter());
    syntaxRegistry.register(new YamlHighlighter());
    services.set([
        { provide: SyntaxHighlighterRegistry_TOKEN, useValue: syntaxRegistry, sealed: true },
    ]);

    if (!pendingTokens.has(ICliEnvironment_TOKEN)) {
        services.set([
            {
                provide: ICliEnvironment_TOKEN,
                useClass: CliEnvironment,
                sealed: true,
            },
        ]);
    }

    services.set([
        {
            provide: ICliDragDropService_TOKEN,
            useValue: dragDropService,
            sealed: true,
        },
    ]);

    const translator = new CliTranslationService();
    services.set([
        { provide: ICliTranslationService_TOKEN, useValue: translator, sealed: true },
    ]);

    return {
        services,
        logger,
        commandHistory,
        stateStoreManager,
        processRegistry,
        translator,
    };
}

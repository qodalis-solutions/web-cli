import { Inject, Injectable } from '@angular/core';
import {
    CliIcon,
    delay,
    ICliCommandChildProcessor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliUmdModule,
    initializeBrowserEnvironment,
} from '@qodalis/cli-core';
import {
    CliCommandProcessor_TOKEN,
    CliProcessorsRegistry_TOKEN,
} from '../../tokens';
import { CliCommandExecutionContext, CliExecutionContext } from '../../context';
import { CliKeyValueStore } from '../../storage/cli-key-value-store';

@Injectable({
    providedIn: 'root',
})
export class CliBoot {
    private initialized = false;
    private initializing = false;

    constructor(
        @Inject(CliCommandProcessor_TOKEN)
        private readonly implementations: ICliCommandProcessor[],

        @Inject(CliProcessorsRegistry_TOKEN)
        private readonly registry: ICliCommandProcessorRegistry,
    ) {}

    public async boot(context: CliExecutionContext): Promise<void> {
        if (this.initialized || this.initializing) {
            return;
        }

        this.initializing = true;

        context.spinner?.show(CliIcon.Rocket + '  Booting...');

        await this.registerServices(context);

        initializeBrowserEnvironment({
            context,
            handlers: [
                async (module: ICliUmdModule) => {
                    await this.registerUmdModule(module, context);
                },
            ],
        });

        let processors = this.implementations;

        //TODO: refactor in a better way
        if (!context.options?.usersModule?.enabled) {
            processors = processors.filter(
                (p) => p.metadata?.module !== 'users',
            );
        }

        processors.forEach((impl) => this.registry.registerProcessor(impl));

        await this.initializeProcessorsInternal(
            context,
            this.registry.processors,
        );

        await delay(300);

        context.spinner?.hide();

        this.initialized = true;
    }

    private async initializeProcessorsInternal(
        context: CliExecutionContext,
        processors: ICliCommandProcessor[],
        parent?: ICliCommandProcessor,
    ): Promise<void> {
        try {
            for (const p of processors) {
                (p as ICliCommandChildProcessor).parent = parent;

                if (p.initialize) {
                    const processorContext = new CliCommandExecutionContext(
                        context,
                        p,
                    );

                    await processorContext.state.initialize();

                    await p.initialize(processorContext);
                }

                if (p.processors && p.processors.length > 0) {
                    await this.initializeProcessorsInternal(
                        context,
                        p.processors,
                        p,
                    );
                }
            }
        } catch (e) {
            context.writer.writeError(`Error initializing processors: ${e}`);
        }
    }

    private async registerServices(
        context: CliExecutionContext,
    ): Promise<void> {
        context.services.set([
            {
                provide: 'cli-key-value-store',
                useValue: context.services.get(CliKeyValueStore),
            },
        ]);
    }

    private async registerUmdModule(
        module: ICliUmdModule,
        context: CliExecutionContext,
    ): Promise<void> {
        const { logger } = context;
        if (!module) {
            return;
        }

        if (module.processors) {
            logger.info('Registering processors from module ' + module.name);
            for (const processor of module.processors) {
                this.registry.registerProcessor(processor);
            }

            await this.initializeProcessorsInternal(context, module.processors);
        } else {
            logger.warn(`Module ${module.name} has no processors`);
        }
    }
}

import { Inject, Injectable } from '@angular/core';
import { CliCommandProcessorRegistry } from '../cli-command-processor-registry';
import { CliIcon, delay, ICliCommandProcessor } from '@qodalis/cli-core';
import { CliCommandProcessor_TOKEN } from '../../tokens';
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
        private readonly registry: CliCommandProcessorRegistry,
    ) {}

    public async boot(context: CliExecutionContext): Promise<void> {
        if (this.initialized || this.initializing) {
            return;
        }

        this.initializing = true;

        context.spinner?.show();
        context.spinner?.setText(CliIcon.Rocket + '  Booting...');

        const store = context.services.get<CliKeyValueStore>(CliKeyValueStore);
        await store.initialize();

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

        await delay(500);

        context.spinner?.hide();

        this.initialized = true;
    }

    private async initializeProcessorsInternal(
        context: CliExecutionContext,
        processors: ICliCommandProcessor[],
    ): Promise<void> {
        try {
            for (const p of processors) {
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
                    );
                }
            }
        } catch (e) {
            context.writer.writeError(`Error initializing processors: ${e}`);
        }
    }
}

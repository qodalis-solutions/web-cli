import { Inject, Injectable } from '@angular/core';
import { CliCommandProcessorRegistry } from '../cli-command-processor-registry';
import {
    CliIcon,
    delay,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliCommandProcessor_TOKEN } from '../../tokens';

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

    public async boot(context: ICliExecutionContext): Promise<void> {
        if (this.initialized || this.initializing) {
            return;
        }
        this.initializing = true;

        let processors = this.implementations;

        if (!context.options?.usersModule?.enabled) {
            processors = processors.filter(
                (p) => p.metadata?.module !== 'users',
            );
        }

        context.spinner?.show();

        context.spinner?.setText(CliIcon.Rocket + '  Booting...');

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
        context: ICliExecutionContext,
        processors: ICliCommandProcessor[],
    ): Promise<void> {
        try {
            for (const p of processors) {
                if (p.initialize) {
                    await p.initialize(context);
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

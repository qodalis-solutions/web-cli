import { Injectable, Injector } from '@angular/core';
import {
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';
import {
    CliHelpCommandProcessor,
    CliVersionCommandProcessor,
    miscProcessors,
} from '../processors';

@Injectable({
    providedIn: 'root',
})
export class CliCommandProcessorRegistry
    implements ICliCommandProcessorRegistry
{
    public readonly processors: ICliCommandProcessor[] = [...miscProcessors];

    constructor(injector: Injector) {
        this.registerProcessor(injector.get(CliHelpCommandProcessor));
        this.registerProcessor(injector.get(CliVersionCommandProcessor));
    }

    public registerProcessor(processor: ICliCommandProcessor): void {
        const existingProcessor = this.getProcessorByName(processor.command);

        if (existingProcessor) {
            if (existingProcessor.metadata?.sealed) {
                console.warn(
                    `Processor with command: ${processor.command} is sealed and cannot be replaced.`,
                );

                return;
            }

            const existingIndex = this.processors.findIndex(
                (p) => p.command === processor.command,
            );

            // Replace the existing processor
            this.processors[existingIndex] = processor;
        } else {
            this.processors.push(processor);
        }
    }

    public unregisterProcessor(processor: ICliCommandProcessor): void {
        const existingProcessor = this.getProcessorByName(processor.command);

        if (existingProcessor) {
            if (existingProcessor.metadata?.sealed) {
                console.warn(
                    `Processor with command: ${processor.command} is sealed and cannot be removed.`,
                );
                return;
            }
        }

        const index = this.processors.findIndex(
            (p) => p.command === processor.command,
        );

        if (index !== -1) {
            this.processors.splice(index, 1);
        }
    }

    public findProcessor(
        mainCommand: string,
        chainCommands: string[],
    ): ICliCommandProcessor | undefined {
        return this.findProcessorInCollection(
            mainCommand,
            chainCommands,
            this.processors,
        );
    }

    /**
     * Recursively searches for a processor matching the given command.
     * @param mainCommand The main command name.
     * @param chainCommands The remaining chain commands (if any).
     * @param processors The list of available processors.
     * @returns The matching processor or undefined if not found.
     */
    public findProcessorInCollection(
        mainCommand: string,
        chainCommands: string[],
        processors: ICliCommandProcessor[],
    ): ICliCommandProcessor | undefined {
        const processor = processors.find(
            (p) => p.command.toLowerCase() === mainCommand.toLowerCase(),
        );

        if (!processor) {
            return undefined;
        }

        if (chainCommands.length === 0) {
            return processor;
        }

        if (processor.processors && processor.processors.length > 0) {
            return this.findProcessorInCollection(
                chainCommands[0],
                chainCommands.slice(1),
                processor.processors,
            );
        } else if (processor.allowUnlistedCommands || processor.valueRequired) {
            return processor;
        }

        return undefined;
    }

    private getProcessorByName(name: string): ICliCommandProcessor | undefined {
        return this.processors.find(
            (p) => p.command.toLowerCase() === name.toLowerCase(),
        );
    }
}

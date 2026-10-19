import {
    ICliCommandChildProcessor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';

export class CliCommandProcessorRegistry implements ICliCommandProcessorRegistry {
    public readonly processors: ICliCommandProcessor[] = [];

    /**
     * Sub-commands each extension (`extendsProcessor`) merged into an
     * existing command, removed again when the extension is unregistered.
     */
    private readonly mergedByExtension = new Map<
        ICliCommandProcessor,
        { target: ICliCommandProcessor; subs: ICliCommandProcessor[] }
    >();

    constructor(initialProcessors?: ICliCommandProcessor[]) {
        if (initialProcessors) {
            this.processors.push(...initialProcessors);
        }
    }

    public registerProcessor(processor: ICliCommandProcessor): void {
        const existingProcessor = this.getProcessorByName(processor.command);

        if (existingProcessor) {
            // Same instance registered again (e.g. via multiple DI paths) — skip silently
            if (existingProcessor === processor) {
                return;
            }

            const existingIndex = this.processors.findIndex(
                (p) => p.command === processor.command,
            );

            if (processor.extendsProcessor) {
                // Extension: merge sub-processors into the existing processor
                // instead of replacing it, so existing sub-commands remain available
                if (processor.processors?.length) {
                    if (!existingProcessor.processors) {
                        existingProcessor.processors = [];
                    }
                    const added: ICliCommandProcessor[] = [];
                    for (const sub of processor.processors) {
                        const exists = existingProcessor.processors.find(
                            (p) => p.command === sub.command,
                        );
                        if (!exists) {
                            existingProcessor.processors.push(sub);
                            added.push(sub);
                        }
                    }
                    if (added.length > 0) {
                        this.mergedByExtension.set(processor, {
                            target: existingProcessor,
                            subs: added,
                        });
                    }
                }
                return;
            }

            if (existingProcessor.metadata?.sealed) {
                console.warn(
                    `Processor with command: ${processor.command} is sealed and cannot be replaced.`,
                );

                return;
            }

            // Replace the existing processor
            this.processors[existingIndex] = processor;
        } else {
            this.processors.push(processor);
        }
    }

    public unregisterProcessor(processor: ICliCommandProcessor): void {
        // An extension only removes the sub-commands it added, never the
        // command it extended (e.g. `pkg remove server-logs` removes
        // `server logs`, not `server`)
        const merged = this.mergedByExtension.get(processor);
        if (merged) {
            this.mergedByExtension.delete(processor);
            merged.target.processors = (merged.target.processors ?? []).filter(
                (sub) => !merged.subs.includes(sub),
            );
            return;
        }
        if (processor.extendsProcessor) {
            // Merged nothing (all its sub-commands already existed)
            const existing = this.getProcessorByName(processor.command);
            if (existing && existing !== processor) return;
        }

        const existingProcessor = this.getProcessorByName(processor.command);

        if (existingProcessor) {
            if (
                existingProcessor.metadata?.sealed &&
                !existingProcessor.originalProcessor
            ) {
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
            const current = this.processors[index];
            if (current.originalProcessor) {
                // Restore the original processor instead of removing
                this.processors[index] = current.originalProcessor;
            } else {
                this.processors.splice(index, 1);
            }
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
        const lowerCommand = mainCommand.toLowerCase();
        const processor = processors.find(
            (p) =>
                p.command.toLowerCase() === lowerCommand ||
                p.aliases?.some((a) => a.toLowerCase() === lowerCommand),
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
        } else if (processor.acceptsRawInput || processor.valueRequired) {
            return processor;
        }

        return undefined;
    }

    public getRootProcessor(
        child: ICliCommandChildProcessor,
    ): ICliCommandProcessor {
        return child.parent ? this.getRootProcessor(child.parent) : child;
    }

    private getProcessorByName(name: string): ICliCommandProcessor | undefined {
        return this.processors.find(
            (p) => p.command.toLowerCase() === name.toLowerCase(),
        );
    }
}

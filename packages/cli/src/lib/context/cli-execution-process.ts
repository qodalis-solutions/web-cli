import { ICliExecutionContext, ICliExecutionProcess } from '@qodalis/cli-core';
import { ProcessExitedError } from '../errors';

export class CliExecutionProcess implements ICliExecutionProcess {
    exited?: boolean | undefined;
    exitCode?: number | undefined;
    running: boolean = false;
    data: any | undefined;

    /**
     * Whether `output()` was explicitly called during this command's execution.
     * Used by the executor to decide whether to auto-capture terminal output.
     */
    outputCalled = false;

    constructor(private readonly context: ICliExecutionContext) {}

    exit(
        code?: number,
        options?: {
            silent?: boolean;
        },
    ) {
        code = code ?? 0;

        this.exited = true;
        this.exitCode = code;
        this.running = false;

        if (!options?.silent) {
            throw new ProcessExitedError(code);
        }
    }

    output(data: any) {
        this.data = data;
        this.outputCalled = true;
    }

    start() {
        this.exited = undefined;
        this.exitCode = undefined;
        this.data = undefined;
        this.outputCalled = false;
        this.running = true;
    }

    end() {
        this.running = false;
        if (!this.exited) {
            this.exitCode = 0;
        }
    }
}

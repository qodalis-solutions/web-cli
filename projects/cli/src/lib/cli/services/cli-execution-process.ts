import { ICliExecutionContext, ICliExecutionProcess } from '@qodalis/cli-core';

export class ProcessExitedError extends Error {
    code: number;

    constructor(code: number) {
        super(`Process exited with code ${code}`);
        this.name = 'ProcessExitedError';
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class CliExecutionProcess implements ICliExecutionProcess {
    exited?: boolean | undefined;
    exitCode?: number | undefined;
    running: boolean = false;
    data: string | undefined;

    constructor(private readonly context: ICliExecutionContext) {}

    exit(code?: number) {
        code = code ?? 0;

        this.exited = true;
        this.exitCode = code;

        throw new ProcessExitedError(code);
    }

    output(data: string) {
        this.data = data;
    }

    start() {
        this.exited = undefined;
        this.exitCode = undefined;
        this.data = undefined;
        this.running = true;
    }

    end() {
        this.running = false;
        this.exitCode = 0;
    }
}

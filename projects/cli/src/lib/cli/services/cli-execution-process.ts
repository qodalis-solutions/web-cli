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
    constructor(private readonly context: ICliExecutionContext) {}

    exit(code?: number) {
        throw new ProcessExitedError(code ?? 0);
    }
}

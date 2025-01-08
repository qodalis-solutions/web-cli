export class ProcessExitedError extends Error {
    code: number;

    constructor(code: number) {
        super(`Process exited with code ${code}`);
        this.name = 'ProcessExitedError';
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

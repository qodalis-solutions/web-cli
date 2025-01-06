import { CliLogLevel, ICliLogger } from '@qodalis/cli-core';

export class CliLogger implements ICliLogger {
    private CliLogLevel: CliLogLevel = CliLogLevel.ERROR;

    constructor() {}

    setCliLogLevel(level: CliLogLevel): void {
        this.CliLogLevel = level;
    }

    log(...args: any[]): void {
        if (this.CliLogLevel <= CliLogLevel.LOG) {
            console.log(...args);
        }
    }

    info(...args: any[]): void {
        if (this.CliLogLevel <= CliLogLevel.INFO) {
            console.info(...args);
        }
    }

    warn(...args: any[]): void {
        if (this.CliLogLevel <= CliLogLevel.WARN) {
            console.warn(...args);
        }
    }

    error(...args: any[]): void {
        if (this.CliLogLevel <= CliLogLevel.ERROR) {
            console.error(...args);
        }
    }

    debug(...args: any[]): void {
        if (this.CliLogLevel <= CliLogLevel.DEBUG) {
            console.debug(...args);
        }
    }
}

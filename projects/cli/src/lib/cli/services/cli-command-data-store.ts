import { ICliCommandDataStore, ICliExecutionContext } from '../models';

export class CliCommandDataStore implements ICliCommandDataStore {
    public data: Record<string, Record<string, any>> = {};

    constructor(private context: ICliExecutionContext) {}

    public appendData(command: string, key: string, data: any) {
        this.data[command] = {
            ...this.data[command],
            [key]: data,
        };
    }

    public getData<T = any>(command: string, key: string): T {
        return this.data[command]?.[key] as T;
    }
}

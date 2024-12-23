import { ICliExecutionContext } from '../models';

export class CliBaseProcessor {
    protected appendData(
        context: ICliExecutionContext,
        command: string,
        key: string,
        data: any,
    ) {
        context.data[command] = {
            ...context.data[command],
            [key]: data,
        };
    }

    protected getData<T = any>(
        context: ICliExecutionContext,
        command: string,
        key: string,
    ): T {
        return context.data[command]?.[key] as T;
    }
}

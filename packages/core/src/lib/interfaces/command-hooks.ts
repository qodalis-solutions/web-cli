import { ICliExecutionContext } from './execution-context';

export interface ICliProcessorHook {
    when: 'before' | 'after';
    execute: (context: ICliExecutionContext) => Promise<void>;
}

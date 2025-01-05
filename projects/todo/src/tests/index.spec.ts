import { CliTodoCommandProcessor } from '../lib/processors/cli-todo-command-processor';

describe('CliTodoModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliTodoCommandProcessor();

        expect(processor).toBeDefined();
    });
});

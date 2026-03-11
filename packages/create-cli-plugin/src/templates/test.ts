import { TemplateVars } from './types';

export function testTemplate(vars: TemplateVars): string {
    return `import { Cli${vars.processorName}CommandProcessor } from '../lib/processors/${vars.processorFileName}';

describe('Cli${vars.processorName}Module', () => {
    it('processor instance should be created', () => {
        const processor = new Cli${vars.processorName}CommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new Cli${vars.processorName}CommandProcessor();
        expect(processor.command).toBe('${vars.name}');
    });
});
`;
}

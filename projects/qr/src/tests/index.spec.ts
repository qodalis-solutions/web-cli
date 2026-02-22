import { CliQrCommandProcessor } from '../lib/processors/cli-qr-command-processor';

describe('CliQrModule', () => {
    let processor: CliQrCommandProcessor;

    beforeEach(() => {
        processor = new CliQrCommandProcessor();
    });

    it('processor instance should be created', () => {
        expect(processor).toBeDefined();
    });

    it('should have the correct command name', () => {
        expect(processor.command).toBe('qr');
    });

    it('should have a generate sub-processor', () => {
        expect(processor.processors).toBeDefined();
        expect(processor.processors!.length).toBe(1);
        expect(processor.processors![0].command).toBe('generate');
    });

    it('generate sub-processor should require text parameter', () => {
        const generateProcessor = processor.processors![0];
        const textParam = generateProcessor.parameters?.find(
            (p) => p.name === 'text',
        );
        expect(textParam).toBeDefined();
        expect(textParam!.required).toBe(true);
    });

    it('generate sub-processor should have optional fileName parameter', () => {
        const generateProcessor = processor.processors![0];
        const fileNameParam = generateProcessor.parameters?.find(
            (p) => p.name === 'fileName',
        );
        expect(fileNameParam).toBeDefined();
        expect(fileNameParam!.required).toBe(false);
    });
});

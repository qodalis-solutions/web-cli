import { CliBase64CommandProcessor } from '../lib/processors/cli-base64-command-processor';
import { CliHexCommandProcessor } from '../lib/processors/cli-hex-command-processor';
import { CliUrlCommandProcessor } from '../lib/processors/cli-url-command-processor';
import { CliHashCommandProcessor } from '../lib/processors/cli-hash-command-processor';
import { CliJwtCommandProcessor } from '../lib/processors/cli-jwt-command-processor';
import { CliBinaryCommandProcessor } from '../lib/processors/cli-binary-command-processor';
import { CliRotCommandProcessor } from '../lib/processors/cli-rot-command-processor';
import { CliMorseCommandProcessor } from '../lib/processors/cli-morse-command-processor';

describe('@qodalis/cli-encode', () => {
    it('base64 processor should be created', () => {
        const processor = new CliBase64CommandProcessor();
        expect(processor).toBeDefined();
        expect(processor.command).toBe('base64');
        expect(processor.processors?.length).toBe(2);
    });

    it('hex processor should be created', () => {
        const processor = new CliHexCommandProcessor();
        expect(processor).toBeDefined();
        expect(processor.command).toBe('hex');
        expect(processor.processors?.length).toBe(3);
    });

    it('url processor should be created', () => {
        const processor = new CliUrlCommandProcessor();
        expect(processor).toBeDefined();
        expect(processor.command).toBe('url');
        expect(processor.processors?.length).toBe(3);
    });

    it('hash processor should be created', () => {
        const processor = new CliHashCommandProcessor();
        expect(processor).toBeDefined();
        expect(processor.command).toBe('hash');
        expect(processor.processors?.length).toBe(4);
    });

    it('jwt processor should be created', () => {
        const processor = new CliJwtCommandProcessor();
        expect(processor).toBeDefined();
        expect(processor.command).toBe('jwt');
        expect(processor.processors?.length).toBe(1);
    });

    it('binary processor should be created', () => {
        const processor = new CliBinaryCommandProcessor();
        expect(processor).toBeDefined();
        expect(processor.command).toBe('binary');
        expect(processor.processors?.length).toBe(2);
    });

    it('rot processor should be created', () => {
        const processor = new CliRotCommandProcessor();
        expect(processor).toBeDefined();
        expect(processor.command).toBe('rot');
    });

    it('morse processor should be created', () => {
        const processor = new CliMorseCommandProcessor();
        expect(processor).toBeDefined();
        expect(processor.command).toBe('morse');
        expect(processor.processors?.length).toBe(2);
    });
});

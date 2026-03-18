import { CliTestHarness } from '@qodalis/cli';
import { CliBase64CommandProcessor } from '../lib/processors/cli-base64-command-processor';
import { CliHexCommandProcessor } from '../lib/processors/cli-hex-command-processor';
import { CliUrlCommandProcessor } from '../lib/processors/cli-url-command-processor';
import { CliHashCommandProcessor } from '../lib/processors/cli-hash-command-processor';
import { CliJwtCommandProcessor } from '../lib/processors/cli-jwt-command-processor';
import { CliBinaryCommandProcessor } from '../lib/processors/cli-binary-command-processor';
import { CliRotCommandProcessor } from '../lib/processors/cli-rot-command-processor';
import { CliMorseCommandProcessor } from '../lib/processors/cli-morse-command-processor';

describe('@qodalis/cli-encode', () => {
    let harness: CliTestHarness;

    beforeEach(() => {
        harness = new CliTestHarness();
        harness.registerProcessors([
            new CliBase64CommandProcessor(),
            new CliHexCommandProcessor(),
            new CliUrlCommandProcessor(),
            new CliHashCommandProcessor(),
            new CliJwtCommandProcessor(),
            new CliBinaryCommandProcessor(),
            new CliRotCommandProcessor(),
            new CliMorseCommandProcessor(),
        ]);
    });

    // -----------------------------------------------------------------------
    // Processor instantiation
    // -----------------------------------------------------------------------

    it('should create all 8 processors', () => {
        expect(new CliBase64CommandProcessor().command).toBe('base64');
        expect(new CliHexCommandProcessor().command).toBe('hex');
        expect(new CliUrlCommandProcessor().command).toBe('url');
        expect(new CliHashCommandProcessor().command).toBe('hash');
        expect(new CliJwtCommandProcessor().command).toBe('jwt');
        expect(new CliBinaryCommandProcessor().command).toBe('binary');
        expect(new CliRotCommandProcessor().command).toBe('rot');
        expect(new CliMorseCommandProcessor().command).toBe('morse');
    });

    // -----------------------------------------------------------------------
    // Base64
    // -----------------------------------------------------------------------

    it('base64 encode should encode text', async () => {
        const result = await harness.execute('base64 encode Hello World');
        expect(result.output).toContain('SGVsbG8gV29ybGQ=');
    });

    it('base64 decode should decode text', async () => {
        const result = await harness.execute('base64 decode SGVsbG8gV29ybGQ=');
        expect(result.output).toContain('Hello World');
    });

    it('base64 decode should error on invalid input', async () => {
        const result = await harness.execute('base64 decode !!!invalid!!!');
        expect(result.exitCode).toBe(-1);
    });

    // -----------------------------------------------------------------------
    // Hex
    // -----------------------------------------------------------------------

    it('hex encode should encode text to hex', async () => {
        const result = await harness.execute('hex encode Hi');
        expect(result.output).toContain('4869');
    });

    it('hex decode should decode hex to text', async () => {
        const result = await harness.execute('hex decode 4869');
        expect(result.output).toContain('Hi');
    });

    it('hex convert should convert decimal to hex', async () => {
        const result = await harness.execute('hex convert 255');
        expect(result.output).toContain('ff');
    });

    it('hex convert should convert between arbitrary bases', async () => {
        const result = await harness.execute('hex convert ff --from=16 --to=2');
        expect(result.output).toContain('11111111');
    });

    // -----------------------------------------------------------------------
    // URL
    // -----------------------------------------------------------------------

    it('url encode should encode text', async () => {
        const result = await harness.execute('url encode hello world');
        expect(result.output).toContain('hello%20world');
    });

    it('url decode should decode text', async () => {
        const result = await harness.execute('url decode hello%20world');
        expect(result.output).toContain('hello world');
    });

    it('url parse should parse a URL', async () => {
        const result = await harness.execute('url parse https://example.com:8080/path?q=1#hash');
        expect(result.output).toContain('https:');
        expect(result.output).toContain('example.com');
        expect(result.output).toContain('8080');
        expect(result.output).toContain('/path');
    });

    // -----------------------------------------------------------------------
    // Hash
    // -----------------------------------------------------------------------

    it('hash sha256 should produce a hex digest', async () => {
        const result = await harness.execute('hash sha256 hello');
        // SHA-256 of "hello" starts with 2cf24dba
        expect(result.output).toContain('2cf24dba');
    });

    it('hash sha1 should produce a hex digest', async () => {
        const result = await harness.execute('hash sha1 hello');
        // SHA-1 of "hello" starts with aaf4c61d
        expect(result.output).toContain('aaf4c61d');
    });

    // -----------------------------------------------------------------------
    // JWT
    // -----------------------------------------------------------------------

    it('jwt decode should decode a valid token', async () => {
        // A minimal JWT: {"alg":"HS256","typ":"JWT"}.{"sub":"1234567890","name":"John"}.signature
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.signature';
        const result = await harness.execute(`jwt decode ${token}`);
        expect(result.output).toContain('Header:');
        expect(result.output).toContain('HS256');
        expect(result.output).toContain('Payload:');
        expect(result.output).toContain('John');
    });

    it('jwt decode should error on invalid token', async () => {
        const result = await harness.execute('jwt decode not-a-jwt');
        expect(result.exitCode).toBe(-1);
    });

    // -----------------------------------------------------------------------
    // Binary
    // -----------------------------------------------------------------------

    it('binary encode should convert text to binary', async () => {
        const result = await harness.execute('binary encode Hi');
        expect(result.output).toContain('01001000 01101001');
    });

    it('binary decode should convert binary to text', async () => {
        const result = await harness.execute('binary decode 01001000 01101001');
        expect(result.output).toContain('Hi');
    });

    it('binary encode/decode should be reversible', async () => {
        const encoded = await harness.execute('binary encode Test123');
        const decoded = await harness.execute(`binary decode ${encoded.data}`);
        expect(decoded.output).toContain('Test123');
    });

    it('binary decode should error on invalid input', async () => {
        const result = await harness.execute('binary decode 0110');
        expect(result.exitCode).toBe(-1);
    });

    // -----------------------------------------------------------------------
    // ROT
    // -----------------------------------------------------------------------

    it('rot should apply ROT13 by default', async () => {
        const result = await harness.execute('rot Hello World');
        expect(result.output).toContain('Uryyb Jbeyq');
    });

    it('rot should be self-inverse with ROT13', async () => {
        const result = await harness.execute('rot Uryyb Jbeyq');
        expect(result.output).toContain('Hello World');
    });

    it('rot should support custom shift', async () => {
        const result = await harness.execute('rot abc --shift=1');
        expect(result.output).toContain('bcd');
    });

    it('rot should preserve non-alpha characters', async () => {
        const result = await harness.execute('rot Hello, World! 123');
        expect(result.output).toContain('Uryyb, Jbeyq! 123');
    });

    it('rot should handle negative shift', async () => {
        const result = await harness.execute('rot bcd --shift=-1');
        expect(result.output).toContain('abc');
    });

    // -----------------------------------------------------------------------
    // Morse
    // -----------------------------------------------------------------------

    it('morse encode should convert text to morse', async () => {
        const result = await harness.execute('morse encode SOS');
        expect(result.output).toContain('... --- ...');
    });

    it('morse decode should convert morse to text', async () => {
        // Use only dot-based morse letters to avoid CLI arg parser consuming dash tokens
        const result = await harness.execute('morse decode ... . ...');
        expect(result.output).toContain('SES');
    });

    it('morse encode should handle spaces as /', async () => {
        const result = await harness.execute('morse encode HI THERE');
        expect(result.output).toContain('/');
    });

    it('morse decode should handle / as word separator', async () => {
        // H=.... I=.. space=/ E=. — avoids dash-prefixed morse codes
        const result = await harness.execute('morse decode .... .. / .');
        expect(result.output).toContain('HI E');
    });

    it('morse encode/decode should be reversible for dot-only letters', async () => {
        // S=... E=. I=.. H=.... — all dot-only morse codes
        const encoded = await harness.execute('morse encode SEIH');
        const decoded = await harness.execute(`morse decode ${encoded.data}`);
        expect(decoded.output).toContain('SEIH');
    });

    it('morse decode should error on invalid morse', async () => {
        const result = await harness.execute('morse decode .........');
        expect(result.exitCode).toBe(-1);
    });
});

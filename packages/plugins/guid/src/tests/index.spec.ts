import {
    generateGUID,
    validateGUID,
    validateAnyGUID,
    detectGUIDVersion,
    formatGUID,
    NIL_GUID,
} from '../lib/utilities';
import { CliGuidCommandProcessor } from '../lib/processors/cli-guid-command-processor';

describe('CliGuidModule', () => {
    describe('generateGUID', () => {
        it('should return a non-null value', () => {
            expect(generateGUID()).not.toBeNull();
        });

        it('should have a length of 36 characters', () => {
            expect(generateGUID().length).toBe(36);
        });

        it('should produce a valid v4 UUID', () => {
            expect(validateGUID(generateGUID())).toBeTrue();
        });

        it('should generate unique values', () => {
            const a = generateGUID();
            const b = generateGUID();
            expect(a).not.toEqual(b);
        });
    });

    describe('validateGUID (v4 strict)', () => {
        it('should accept a valid v4 UUID', () => {
            expect(
                validateGUID('550e8400-e29b-41d4-a716-446655440000'),
            ).toBeTrue();
        });

        it('should reject a v1 UUID', () => {
            expect(
                validateGUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
            ).toBeFalse();
        });

        it('should reject the nil UUID', () => {
            expect(validateGUID(NIL_GUID)).toBeFalse();
        });

        it('should reject empty string', () => {
            expect(validateGUID('')).toBeFalse();
        });

        it('should reject malformed strings', () => {
            expect(validateGUID('not-a-uuid')).toBeFalse();
            expect(validateGUID('550e8400e29b41d4a716446655440000')).toBeFalse();
        });
    });

    describe('validateAnyGUID', () => {
        it('should accept v4 UUID', () => {
            expect(
                validateAnyGUID('550e8400-e29b-41d4-a716-446655440000'),
            ).toBeTrue();
        });

        it('should accept v1 UUID', () => {
            expect(
                validateAnyGUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
            ).toBeTrue();
        });

        it('should accept nil UUID', () => {
            expect(validateAnyGUID(NIL_GUID)).toBeTrue();
        });

        it('should reject invalid input', () => {
            expect(validateAnyGUID('not-valid')).toBeFalse();
        });
    });

    describe('detectGUIDVersion', () => {
        it('should detect v4', () => {
            expect(
                detectGUIDVersion('550e8400-e29b-41d4-a716-446655440000'),
            ).toBe(4);
        });

        it('should detect v1', () => {
            expect(
                detectGUIDVersion('6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
            ).toBe(1);
        });

        it('should detect nil as version 0', () => {
            expect(detectGUIDVersion(NIL_GUID)).toBe(0);
        });

        it('should return null for invalid input', () => {
            expect(detectGUIDVersion('garbage')).toBeNull();
        });
    });

    describe('formatGUID', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';

        it('should return default format', () => {
            expect(formatGUID(uuid, 'default')).toBe(
                '550e8400-e29b-41d4-a716-446655440000',
            );
        });

        it('should return uppercase format', () => {
            expect(formatGUID(uuid, 'uppercase')).toBe(
                '550E8400-E29B-41D4-A716-446655440000',
            );
        });

        it('should return braces format', () => {
            expect(formatGUID(uuid, 'braces')).toBe(
                '{550e8400-e29b-41d4-a716-446655440000}',
            );
        });

        it('should return parentheses format', () => {
            expect(formatGUID(uuid, 'parentheses')).toBe(
                '(550e8400-e29b-41d4-a716-446655440000)',
            );
        });

        it('should return digits-only format', () => {
            expect(formatGUID(uuid, 'digits')).toBe(
                '550e8400e29b41d4a716446655440000',
            );
        });

        it('should return URN format', () => {
            expect(formatGUID(uuid, 'urn')).toBe(
                'urn:uuid:550e8400-e29b-41d4-a716-446655440000',
            );
        });
    });

    describe('NIL_GUID', () => {
        it('should be all zeros', () => {
            expect(NIL_GUID).toBe('00000000-0000-0000-0000-000000000000');
        });
    });

    describe('CliGuidCommandProcessor', () => {
        let processor: CliGuidCommandProcessor;

        beforeEach(() => {
            processor = new CliGuidCommandProcessor();
        });

        it('should have command "guid"', () => {
            expect(processor.command).toBe('guid');
        });

        it('should have alias "uuid"', () => {
            expect(processor.aliases).toContain('uuid');
        });

        it('should have sub-processors', () => {
            expect(processor.processors).toBeDefined();
            expect(processor.processors!.length).toBeGreaterThan(0);
        });

        it('should have new, validate, format, inspect, nil, compare sub-commands', () => {
            const commands = processor.processors!.map((p) => p.command);
            expect(commands).toContain('new');
            expect(commands).toContain('validate');
            expect(commands).toContain('format');
            expect(commands).toContain('inspect');
            expect(commands).toContain('nil');
            expect(commands).toContain('compare');
        });

        it('should have unique sub-command names', () => {
            const commands = processor.processors!.map((p) => p.command);
            expect(new Set(commands).size).toBe(commands.length);
        });

        it('new sub-command should have count and format parameters', () => {
            const newCmd = processor.processors!.find(
                (p) => p.command === 'new',
            );
            expect(newCmd).toBeDefined();
            const paramNames = newCmd!.parameters!.map((p) => p.name);
            expect(paramNames).toContain('count');
            expect(paramNames).toContain('format');
            expect(paramNames).toContain('copy');
        });

        it('validate sub-command should have strict parameter', () => {
            const validateCmd = processor.processors!.find(
                (p) => p.command === 'validate',
            );
            expect(validateCmd).toBeDefined();
            const paramNames = validateCmd!.parameters!.map((p) => p.name);
            expect(paramNames).toContain('strict');
        });

        it('format sub-command should require a value', () => {
            const formatCmd = processor.processors!.find(
                (p) => p.command === 'format',
            );
            expect(formatCmd).toBeDefined();
            expect(formatCmd!.valueRequired).toBeTrue();
        });
    });
});

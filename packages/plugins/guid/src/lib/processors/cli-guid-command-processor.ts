import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliConfigurationOption,
    ICliExecutionContext,
    getPluginConfigValue,
} from '@qodalis/cli-core';
import {
    generateGUID,
    validateGUID,
    validateAnyGUID,
    detectGUIDVersion,
    formatGUID,
    NIL_GUID,
    GuidFormat,
} from '../utilities';
import { LIBRARY_VERSION } from '../version';

const GUID_FORMATS: GuidFormat[] = [
    'default',
    'uppercase',
    'braces',
    'parentheses',
    'digits',
    'urn',
];

export class CliGuidCommandProcessor implements ICliCommandProcessor {
    command = 'guid';

    aliases = ['uuid'];

    description = 'Generate, validate, format, and inspect UUIDs';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '🆔',
        module: 'guid',
    };

    configurationOptions?: ICliConfigurationOption[] = [
        {
            key: 'defaultFormat',
            label: 'Default Format',
            description: 'Default output format for generated UUIDs',
            type: 'select',
            defaultValue: 'default',
            options: GUID_FORMATS.map((f) => ({ label: f, value: f })),
        },
        {
            key: 'autoCopy',
            label: 'Auto-Copy to Clipboard',
            description: 'Automatically copy generated UUIDs to clipboard',
            type: 'boolean',
            defaultValue: false,
        },
    ];

    constructor() {
        this.processors = [
            // --- new ---
            {
                command: 'new',
                aliases: ['gen', 'generate'],
                description: 'Generate one or more UUIDs',
                parameters: [
                    {
                        name: 'copy',
                        aliases: ['c'],
                        description: 'Copy the result to the clipboard',
                        required: false,
                        type: 'boolean',
                    },
                    {
                        name: 'count',
                        aliases: ['n'],
                        description: 'Number of UUIDs to generate',
                        defaultValue: '1',
                        required: false,
                        type: 'number',
                    },
                    {
                        name: 'format',
                        aliases: ['f'],
                        description: `Output format: ${GUID_FORMATS.join(', ')}`,
                        defaultValue: 'default',
                        required: false,
                        type: 'string',
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const count = command.args['count']
                        ? parseInt(command.args['count'])
                        : 1;

                    if (isNaN(count) || count < 1 || count > 1000) {
                        context.writer.writeError(
                            'Count must be a number between 1 and 1000',
                        );
                        return;
                    }

                    const cfgFormat = getPluginConfigValue(context, 'guid', 'defaultFormat', 'default');
                    const cfgAutoCopy = getPluginConfigValue(context, 'guid', 'autoCopy', false);

                    const format = (command.args['format'] ||
                        cfgFormat) as GuidFormat;

                    if (!GUID_FORMATS.includes(format)) {
                        context.writer.writeError(
                            `Unknown format "${format}". Available: ${GUID_FORMATS.join(', ')}`,
                        );
                        return;
                    }

                    const copyToClipboard =
                        command.args['copy'] != null ? !!command.args['copy']
                        : command.args['c'] != null ? !!command.args['c']
                        : cfgAutoCopy;

                    const items: string[] = [];

                    for (let i = 0; i < count; i++) {
                        const guid = formatGUID(generateGUID(), format);
                        context.writer.writeln(guid);
                        items.push(guid);
                    }

                    if (copyToClipboard) {
                        await context.clipboard.write(items.join('\n'));
                        context.writer.writeInfo(
                            items.length === 1
                                ? 'Copied to clipboard'
                                : `${items.length} UUIDs copied to clipboard`,
                        );
                    }

                    context.process.output(
                        items.length === 1 ? items[0] : items,
                    );
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Generate one or more UUIDs (v4)');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('guid new', CliForegroundColor.Cyan)}                           Generate a single UUID`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('guid new --count=5', CliForegroundColor.Cyan)}                   Generate 5 UUIDs`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('guid new --copy', CliForegroundColor.Cyan)}                      Generate and copy`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('guid new --format=uppercase', CliForegroundColor.Cyan)}          Uppercase output`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('guid new --format=braces', CliForegroundColor.Cyan)}             {wrapped} format`,
                    );
                    writer.writeln();
                    writer.writeln(
                        `Formats: ${writer.wrapInColor(GUID_FORMATS.join(', '), CliForegroundColor.Yellow)}`,
                    );
                },
            },

            // --- validate ---
            {
                command: 'validate',
                aliases: ['check'],
                description: 'Validate a UUID string',
                acceptsRawInput: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'strict',
                        description:
                            'Only accept v4 UUIDs (default: accept any version)',
                        required: false,
                        type: 'boolean',
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = command.value!;
                    const strict = command.args['strict'];
                    const isValid = strict
                        ? validateGUID(input)
                        : validateAnyGUID(input);

                    if (isValid) {
                        const version = detectGUIDVersion(input);
                        const versionLabel =
                            version === 0
                                ? 'nil'
                                : version
                                  ? `v${version}`
                                  : 'unknown version';
                        context.writer.writeSuccess(
                            `Valid UUID (${versionLabel})`,
                        );
                        context.process.output({ valid: true, version });
                    } else {
                        context.writer.writeError(
                            `Invalid UUID: ${input}`,
                        );
                        context.process.output({
                            valid: false,
                            version: null,
                        });
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Validate a UUID string and detect its version');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('guid validate <uuid>', CliForegroundColor.Cyan)}                  Check any UUID`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('guid validate <uuid> --strict', CliForegroundColor.Cyan)}         Only accept v4`,
                    );
                },
            },

            // --- format ---
            {
                command: 'format',
                aliases: ['fmt'],
                description: 'Convert a UUID to a different format',
                acceptsRawInput: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'to',
                        aliases: ['t'],
                        description: `Target format: ${GUID_FORMATS.join(', ')}`,
                        defaultValue: 'default',
                        required: false,
                        type: 'string',
                    },
                    {
                        name: 'copy',
                        aliases: ['c'],
                        description: 'Copy the result to the clipboard',
                        required: false,
                        type: 'boolean',
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = command.value!;

                    const clean = input.replace(/[-{}()urn:uuid ]/g, '');
                    if (!/^[0-9a-fA-F]{32}$/.test(clean)) {
                        context.writer.writeError(
                            `Cannot parse as UUID: ${input}`,
                        );
                        return;
                    }

                    const format = (command.args['to'] ||
                        'default') as GuidFormat;

                    if (!GUID_FORMATS.includes(format)) {
                        context.writer.writeError(
                            `Unknown format "${format}". Available: ${GUID_FORMATS.join(', ')}`,
                        );
                        return;
                    }

                    const normalized = `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`.toLowerCase();
                    const result = formatGUID(normalized, format);

                    context.writer.writeln(result);

                    if (command.args['copy'] || command.args['c']) {
                        await context.clipboard.write(result);
                        context.writer.writeInfo('Copied to clipboard');
                    }

                    context.process.output(result);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Convert a UUID between different formats');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('guid format <uuid> --to=braces', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('guid format <uuid> --to=urn', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(
                        `Formats: ${writer.wrapInColor(GUID_FORMATS.join(', '), CliForegroundColor.Yellow)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  guid format 550e8400-e29b-41d4-a716-446655440000 --to=braces`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('→ {550e8400-e29b-41d4-a716-446655440000}', CliForegroundColor.Green)}`,
                    );
                },
            },

            // --- inspect ---
            {
                command: 'inspect',
                aliases: ['info', 'parse'],
                description: 'Show detailed information about a UUID',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = command.value!;
                    const { writer } = context;

                    if (!validateAnyGUID(input)) {
                        writer.writeError(`Invalid UUID: ${input}`);
                        return;
                    }

                    const version = detectGUIDVersion(input);
                    const isNil = input === NIL_GUID;
                    const lower = input.toLowerCase();
                    const variantBits = parseInt(lower.charAt(19), 16);

                    let variant: string;
                    if ((variantBits & 0x8) === 0) {
                        variant = 'NCS (reserved)';
                    } else if ((variantBits & 0xc) === 0x8) {
                        variant = 'RFC 4122';
                    } else if ((variantBits & 0xe) === 0xc) {
                        variant = 'Microsoft (reserved)';
                    } else {
                        variant = 'Future (reserved)';
                    }

                    writer.writeln(
                        writer.wrapInColor(
                            '── UUID Details ──',
                            CliForegroundColor.Cyan,
                        ),
                    );
                    writer.writeln();
                    writer.writeln(
                        `  ${writer.wrapInColor('Input:', CliForegroundColor.Yellow)}     ${input}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Version:', CliForegroundColor.Yellow)}   ${isNil ? 'nil' : version !== null ? `v${version}` : 'unknown'}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Variant:', CliForegroundColor.Yellow)}   ${variant}`,
                    );
                    writer.writeln();
                    writer.writeln(
                        `  ${writer.wrapInColor('Formats:', CliForegroundColor.Yellow)}`,
                    );

                    for (const fmt of GUID_FORMATS) {
                        const formatted = formatGUID(lower, fmt);
                        writer.writeln(
                            `    ${writer.wrapInColor(fmt.padEnd(14), CliForegroundColor.Cyan)} ${formatted}`,
                        );
                    }

                    context.process.output({
                        input,
                        version,
                        variant,
                        isNil,
                        formats: Object.fromEntries(
                            GUID_FORMATS.map((fmt) => [
                                fmt,
                                formatGUID(lower, fmt),
                            ]),
                        ),
                    });
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln(
                        'Display version, variant, and all format representations of a UUID',
                    );
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('guid inspect <uuid>', CliForegroundColor.Cyan)}`,
                    );
                },
            },

            // --- nil ---
            {
                command: 'nil',
                aliases: ['empty', 'zero'],
                description: 'Output the nil UUID (all zeros)',
                parameters: [
                    {
                        name: 'copy',
                        aliases: ['c'],
                        description: 'Copy to clipboard',
                        required: false,
                        type: 'boolean',
                    },
                ],
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    context.writer.writeln(NIL_GUID);

                    if (_.args['copy'] || _.args['c']) {
                        await context.clipboard.write(NIL_GUID);
                        context.writer.writeInfo('Copied to clipboard');
                    }

                    context.process.output(NIL_GUID);
                },
            },

            // --- compare ---
            {
                command: 'compare',
                aliases: ['eq', 'equals'],
                description: 'Check if two UUIDs are equal (case/format insensitive)',
                acceptsRawInput: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const raw = (command.value || '').trim();
                    const parts = raw.split(/\s+/);

                    if (parts.length !== 2) {
                        context.writer.writeError(
                            'Provide exactly two UUIDs to compare',
                        );
                        context.writer.writeln();
                        context.writer.writeln(
                            `  Usage: ${context.writer.wrapInColor('guid compare <uuid1> <uuid2>', CliForegroundColor.Cyan)}`,
                        );
                        return;
                    }

                    const [a, b] = parts;
                    const cleanA = a.replace(/[-{}()urn:uuid ]/g, '').toLowerCase();
                    const cleanB = b.replace(/[-{}()urn:uuid ]/g, '').toLowerCase();

                    if (
                        !/^[0-9a-f]{32}$/.test(cleanA) ||
                        !/^[0-9a-f]{32}$/.test(cleanB)
                    ) {
                        context.writer.writeError(
                            'One or both inputs are not valid UUIDs',
                        );
                        return;
                    }

                    const equal = cleanA === cleanB;

                    if (equal) {
                        context.writer.writeSuccess('The UUIDs are equal');
                    } else {
                        context.writer.writeError('The UUIDs are different');
                    }

                    context.process.output({ equal, a, b });
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln(
                        'Compare two UUIDs for equality regardless of case or format',
                    );
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('guid compare <uuid1> <uuid2>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  guid compare 550e8400-e29b-41d4-a716-446655440000 550E8400-E29B-41D4-A716-446655440000`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('→ The UUIDs are equal', CliForegroundColor.Green)}`,
                    );
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        await context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('📋 Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('guid new', CliForegroundColor.Cyan)}                           Generate UUIDs`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('guid validate <uuid>', CliForegroundColor.Cyan)}               Validate and detect version`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('guid format <uuid> --to=<fmt>', CliForegroundColor.Cyan)}      Convert format`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('guid inspect <uuid>', CliForegroundColor.Cyan)}                Show detailed info`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('guid compare <a> <b>', CliForegroundColor.Cyan)}               Compare two UUIDs`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('guid nil', CliForegroundColor.Cyan)}                           Output nil UUID`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  guid new --count=5 --copy                        ${writer.wrapInColor('# 5 UUIDs, copied', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  guid new --format=uppercase                      ${writer.wrapInColor('# A1B2C3D4-...', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  guid validate 550e8400-e29b-41d4-a716-446655440000  ${writer.wrapInColor('# Valid UUID (v4)', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  guid inspect 550e8400-e29b-41d4-a716-446655440000   ${writer.wrapInColor('# Version, variant, formats', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  guid format <uuid> --to=urn                      ${writer.wrapInColor('# urn:uuid:...', CliForegroundColor.Green)}`,
        );
    }
}

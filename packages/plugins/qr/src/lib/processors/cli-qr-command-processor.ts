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
import QRCodeStyling from 'qr-code-styling';
import { LIBRARY_VERSION } from '../version';

export class CliQrCommandProcessor implements ICliCommandProcessor {
    command = 'qr';

    description =
        'Provide utility functions to generate QR codes. Usage: qr generate --text "https://example.com" --fileName "my-qr"';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    configurationOptions?: ICliConfigurationOption[] = [
        {
            key: 'defaultWidth',
            label: 'Default Width',
            description: 'Default QR code width in pixels',
            type: 'number',
            defaultValue: 300,
            validator: (v) => ({
                valid: typeof v === 'number' && v >= 50 && v <= 2000,
                message: 'Must be between 50 and 2000',
            }),
        },
        {
            key: 'defaultHeight',
            label: 'Default Height',
            description: 'Default QR code height in pixels',
            type: 'number',
            defaultValue: 300,
            validator: (v) => ({
                valid: typeof v === 'number' && v >= 50 && v <= 2000,
                message: 'Must be between 50 and 2000',
            }),
        },
    ];

    constructor() {
        this.processors = [
            {
                command: 'generate',
                description:
                    'Generate a QR code and download it as PNG. Usage: qr generate --text "https://example.com"',
                parameters: [
                    {
                        name: 'text',
                        description: 'Text or URL to encode as a QR code',
                        type: 'string',
                        required: true,
                    },
                    {
                        name: 'fileName',
                        description: 'the file name',
                        type: 'string',
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    const text = command.args['text'];

                    if (!text) {
                        context.writer.writeError(
                            'Missing required parameter: --text',
                        );
                        return;
                    }

                    const fileName = command.args['fileName'] || 'qr-code';
                    const width = command.args['width'] ?? getPluginConfigValue(context, 'qr', 'defaultWidth', 300);
                    const height = command.args['height'] ?? getPluginConfigValue(context, 'qr', 'defaultHeight', 300);

                    try {
                        const qrCode = new QRCodeStyling({
                            width,
                            height,
                            data: text,
                            type: 'svg',
                        });

                        await qrCode.download({
                            name: fileName,
                            extension: 'png',
                        });

                        context.writer.writeSuccess(
                            `QR Code for "${text}" downloaded as ${fileName}.png`,
                        );
                    } catch (err) {
                        context.writer.writeError(
                            `Failed to generate QR code: ${err}`,
                        );
                    }
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(
            'Generate QR codes from text or URLs and download as PNG',
        );
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('qr generate --text="<content>"', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln('⚙️  Options:');
        writer.writeln(
            `  ${writer.wrapInColor('--text', CliForegroundColor.Yellow)}          Text or URL to encode (required)`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--fileName', CliForegroundColor.Yellow)}      Output filename (default: qr-code)`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  qr generate --text="https://example.com"                ${writer.wrapInColor('# URL QR code', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  qr generate --text="Hello!" --fileName="my-qr"          ${writer.wrapInColor('# Custom filename', CliForegroundColor.Green)}`,
        );
    }
}

import { Injectable } from '@angular/core';
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import QRCodeStyling from 'qr-code-styling';
import { LIBRARY_VERSION } from '../version';

@Injectable()
export class CliQrCommandProcessor implements ICliCommandProcessor {
    command = 'qr';

    description =
        'Provide utility functions to generate QR codes. Usage: qr generate --text "https://example.com" --fileName "my-qr"';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

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

                    try {
                        const qrCode = new QRCodeStyling({
                            width: 300,
                            height: 300,
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
        context.writer.writeln(this.description!);
    }
}

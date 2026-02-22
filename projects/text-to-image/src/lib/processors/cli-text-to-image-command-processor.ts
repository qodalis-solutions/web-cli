import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class CliTextToImageCommandProcessor implements ICliCommandProcessor {
    command = 'text-to-image';
    description = 'Convert text to image';
    author = DefaultLibraryAuthor;
    valueRequired = true;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🖼️',
        requiredCoreVersion: '0.0.16',
        requiredCliVersion: '1.0.37',
    };

    parameters?: ICliCommandParameterDescriptor[] | undefined = [
        {
            name: 'fileName',
            description: 'Name of the file',
            type: 'string',
            required: false,
        },
        {
            name: 'width',
            description: 'Width of the image',
            type: 'integer',
            required: false,
        },
        {
            name: 'height',
            description: 'Height of the image',
            type: 'integer',
            required: false,
        },
        {
            name: 'bgColor',
            description: 'Background color of the image, in hex format',
            type: 'string',
            required: false,
        },
        {
            name: 'textColor',
            description: 'Text color of the image, in hex format',
            type: 'string',
            required: false,
        },
        {
            name: 'font',
            description: 'Font style and size',
            type: 'string',
            required: false,
        },
    ];

    allowUnlistedCommands = true;

    version = LIBRARY_VERSION;

    constructor() {}

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const text = command.value || '';
        const width = command.args['width'] ?? window.innerWidth;
        const height = command.args['height'] ?? window.innerHeight;
        const filename = command.args['fileName'] ?? 'text-image.png';

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            console.error('Failed to get canvas context');
            context.writer.writeError('Failed to get canvas context');
            return;
        }

        // Set background color
        ctx.fillStyle = command.args['bgColor'] || '#ffffff'; // White background
        ctx.fillRect(0, 0, width, height);

        // Set text properties
        ctx.fillStyle = command.args['textColor'] || '#000000'; // Black text
        ctx.font = command.args['font'] || '30px Arial'; // Font style and size
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Render text
        const x = width / 2;
        const y = height / 2;
        ctx.fillText(text, x, y);

        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png');

        // Create a link element to trigger download
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        context.writer.writeInfo('Options: ');
        context.writer.writeInfo(
            `- ${context.writer.wrapInColor('Text', CliForegroundColor.Yellow)}: ${text}`,
        );
        context.writer.writeInfo(
            `- ${context.writer.wrapInColor('Width', CliForegroundColor.Yellow)}: ${width}`,
        );
        context.writer.writeInfo(
            `- ${context.writer.wrapInColor('Height', CliForegroundColor.Yellow)}: ${height}`,
        );
        context.writer.writeInfo(
            `- ${context.writer.wrapInColor('Filename', CliForegroundColor.Yellow)}: ${filename}`,
        );
        context.writer.writeInfo(
            `- ${context.writer.wrapInColor('Background color', CliForegroundColor.Yellow)}: ${ctx.fillStyle}`,
        );
        context.writer.writeInfo(
            `- ${context.writer.wrapInColor('Text color', CliForegroundColor.Yellow)}: ${ctx.fillStyle}`,
        );
        context.writer.writeInfo(
            `- ${context.writer.wrapInColor('Font', CliForegroundColor.Yellow)}: ${ctx.font}`,
        );

        context.writer.writeSuccess('Image created successfully');
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Convert text into a downloadable PNG image');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('text-to-image <text> [options]', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln('⚙️  Options:');
        writer.writeln(`  ${writer.wrapInColor('--width', CliForegroundColor.Yellow)}          Image width (default: window width)`);
        writer.writeln(`  ${writer.wrapInColor('--height', CliForegroundColor.Yellow)}         Image height (default: window height)`);
        writer.writeln(`  ${writer.wrapInColor('--bgColor', CliForegroundColor.Yellow)}        Background color in hex (default: #ffffff)`);
        writer.writeln(`  ${writer.wrapInColor('--textColor', CliForegroundColor.Yellow)}      Text color in hex (default: #000000)`);
        writer.writeln(`  ${writer.wrapInColor('--font', CliForegroundColor.Yellow)}           Font style (default: 30px Arial)`);
        writer.writeln(`  ${writer.wrapInColor('--fileName', CliForegroundColor.Yellow)}       Output filename (default: text-image.png)`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  text-to-image "Hello World"                                      ${writer.wrapInColor('# Basic', CliForegroundColor.Green)}`);
        writer.writeln(`  text-to-image "Banner" --bgColor=#1a1a2e --textColor=#e0e0e0     ${writer.wrapInColor('# Custom colors', CliForegroundColor.Green)}`);
    }
}

import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliConfigurationOption,
    ICliExecutionContext,
    getPluginConfigValue,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 400;
const DEFAULT_BG_COLOR = '#ffffff';
const DEFAULT_TEXT_COLOR = '#000000';
const DEFAULT_FONT = '30px Arial';
const DEFAULT_FILENAME = 'text-image.png';
const DEFAULT_PADDING = 40;

export class CliTextToImageCommandProcessor implements ICliCommandProcessor {
    command = 'text-to-image';
    description = 'Convert text to image';
    author = DefaultLibraryAuthor;
    valueRequired = true;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🖼️',
        module: 'text-to-image',
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    configurationOptions?: ICliConfigurationOption[] = [
        {
            key: 'defaultWidth',
            label: 'Default Width',
            description: 'Default image width in pixels',
            type: 'number',
            defaultValue: DEFAULT_WIDTH,
            validator: (v) => ({
                valid: typeof v === 'number' && v >= 50 && v <= 4096,
                message: 'Must be between 50 and 4096',
            }),
        },
        {
            key: 'defaultHeight',
            label: 'Default Height',
            description: 'Default image height in pixels',
            type: 'number',
            defaultValue: DEFAULT_HEIGHT,
            validator: (v) => ({
                valid: typeof v === 'number' && v >= 50 && v <= 4096,
                message: 'Must be between 50 and 4096',
            }),
        },
        {
            key: 'defaultBgColor',
            label: 'Background Color',
            description: 'Default background color (hex format)',
            type: 'string',
            defaultValue: DEFAULT_BG_COLOR,
        },
        {
            key: 'defaultTextColor',
            label: 'Text Color',
            description: 'Default text color (hex format)',
            type: 'string',
            defaultValue: DEFAULT_TEXT_COLOR,
        },
        {
            key: 'defaultFont',
            label: 'Font',
            description: 'Default font specification (e.g. "30px Arial")',
            type: 'string',
            defaultValue: DEFAULT_FONT,
        },
    ];

    parameters?: ICliCommandParameterDescriptor[] | undefined = [
        {
            name: 'fileName',
            description: `Output filename (default: ${DEFAULT_FILENAME})`,
            type: 'string',
            required: false,
        },
        {
            name: 'width',
            description: `Image width in pixels (default: ${DEFAULT_WIDTH})`,
            type: 'integer',
            required: false,
        },
        {
            name: 'height',
            description: `Image height in pixels (default: ${DEFAULT_HEIGHT})`,
            type: 'integer',
            required: false,
        },
        {
            name: 'bgColor',
            description: `Background color in hex format (default: ${DEFAULT_BG_COLOR})`,
            type: 'string',
            required: false,
        },
        {
            name: 'textColor',
            description: `Text color in hex format (default: ${DEFAULT_TEXT_COLOR})`,
            type: 'string',
            required: false,
        },
        {
            name: 'font',
            description: `CSS font string, e.g. "bold 48px Georgia" (default: ${DEFAULT_FONT})`,
            type: 'string',
            required: false,
        },
        {
            name: 'padding',
            description: `Padding in pixels around the text (default: ${DEFAULT_PADDING})`,
            type: 'integer',
            required: false,
        },
        {
            name: 'textAlign',
            description: 'Horizontal text alignment: left, center, or right (default: center)',
            type: 'string',
            required: false,
        },
    ];

    acceptsRawInput = true;

    version = LIBRARY_VERSION;

    constructor() {}

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const text = command.value || '';
        const width = command.args['width'] ?? getPluginConfigValue(context, 'text-to-image', 'defaultWidth', DEFAULT_WIDTH);
        const height = command.args['height'] ?? getPluginConfigValue(context, 'text-to-image', 'defaultHeight', DEFAULT_HEIGHT);
        const filename = command.args['fileName'] ?? DEFAULT_FILENAME;
        const bgColor = command.args['bgColor'] ?? getPluginConfigValue(context, 'text-to-image', 'defaultBgColor', DEFAULT_BG_COLOR);
        const textColor = command.args['textColor'] ?? getPluginConfigValue(context, 'text-to-image', 'defaultTextColor', DEFAULT_TEXT_COLOR);
        const font = command.args['font'] ?? getPluginConfigValue(context, 'text-to-image', 'defaultFont', DEFAULT_FONT);
        const padding = command.args['padding'] ?? DEFAULT_PADDING;
        const textAlign = command.args['textAlign'] || 'center';

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            context.writer.writeError('Failed to get canvas context');
            return;
        }

        // Fill background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);

        // Configure text rendering
        ctx.fillStyle = textColor;
        ctx.font = font;
        ctx.textAlign = textAlign as CanvasTextAlign;
        ctx.textBaseline = 'middle';

        // Wrap and render text
        const maxTextWidth = width - padding * 2;
        const lines = this.wrapText(ctx, text, maxTextWidth);
        const lineHeight = this.getLineHeight(ctx);
        const totalTextHeight = lines.length * lineHeight;
        const startY = (height - totalTextHeight) / 2 + lineHeight / 2;

        let x: number;
        if (textAlign === 'left') {
            x = padding;
        } else if (textAlign === 'right') {
            x = width - padding;
        } else {
            x = width / 2;
        }

        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, startY + i * lineHeight);
        }

        // Trigger download
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Report applied options
        const label = (name: string) =>
            context.writer.wrapInColor(name, CliForegroundColor.Yellow);
        context.writer.writeInfo('Options:');
        context.writer.writeInfo(`  ${label('Text')}: ${text}`);
        context.writer.writeInfo(`  ${label('Size')}: ${width} x ${height}`);
        context.writer.writeInfo(`  ${label('Background')}: ${bgColor}`);
        context.writer.writeInfo(`  ${label('Text color')}: ${textColor}`);
        context.writer.writeInfo(`  ${label('Font')}: ${font}`);
        context.writer.writeInfo(`  ${label('Padding')}: ${padding}px`);
        context.writer.writeInfo(`  ${label('Alignment')}: ${textAlign}`);
        context.writer.writeInfo(`  ${label('Filename')}: ${filename}`);
        if (lines.length > 1) {
            context.writer.writeInfo(`  ${label('Lines')}: ${lines.length}`);
        }
        context.writer.writeln();
        context.writer.writeSuccess('Image created successfully');
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Convert text into a downloadable PNG image with word wrapping');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('text-to-image <text> [options]', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln('Options:');
        writer.writeln(
            `  ${writer.wrapInColor('--width', CliForegroundColor.Yellow)}          Image width in pixels (default: ${DEFAULT_WIDTH})`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--height', CliForegroundColor.Yellow)}         Image height in pixels (default: ${DEFAULT_HEIGHT})`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--bgColor', CliForegroundColor.Yellow)}        Background color in hex (default: ${DEFAULT_BG_COLOR})`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--textColor', CliForegroundColor.Yellow)}      Text color in hex (default: ${DEFAULT_TEXT_COLOR})`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--font', CliForegroundColor.Yellow)}           CSS font string (default: ${DEFAULT_FONT})`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--fileName', CliForegroundColor.Yellow)}       Output filename (default: ${DEFAULT_FILENAME})`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--padding', CliForegroundColor.Yellow)}        Padding around text in pixels (default: ${DEFAULT_PADDING})`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--textAlign', CliForegroundColor.Yellow)}      Text alignment: left, center, right (default: center)`,
        );
        writer.writeln();
        writer.writeln('Examples:');
        writer.writeln(
            `  text-to-image "Hello World"`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('# Download a centered 800x400 image with default styling', CliForegroundColor.Green)}`,
        );
        writer.writeln();
        writer.writeln(
            `  text-to-image "Welcome Banner" --bgColor=#1a1a2e --textColor=#e0e0e0 --font="bold 48px Georgia"`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('# Dark background with light text in a custom font', CliForegroundColor.Green)}`,
        );
        writer.writeln();
        writer.writeln(
            `  text-to-image "This is a long paragraph that will automatically wrap to fit within the image boundaries" --width=600 --height=300`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('# Long text is wrapped automatically', CliForegroundColor.Green)}`,
        );
        writer.writeln();
        writer.writeln(
            `  text-to-image "Left aligned notes" --textAlign=left --padding=60`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('# Left-aligned with extra padding', CliForegroundColor.Green)}`,
        );
    }

    private wrapText(
        ctx: CanvasRenderingContext2D,
        text: string,
        maxWidth: number,
    ): string[] {
        if (!text) return [''];

        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }

    private getLineHeight(ctx: CanvasRenderingContext2D): number {
        const metrics = ctx.measureText('Mg');
        const ascent = metrics.actualBoundingBoxAscent ?? 0;
        const descent = metrics.actualBoundingBoxDescent ?? 0;
        return (ascent + descent) * 1.4 || 36;
    }
}

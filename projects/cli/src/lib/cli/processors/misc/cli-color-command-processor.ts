import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliColorCommandProcessor implements ICliCommandProcessor {
    command = 'color';

    aliases = ['colour'];

    description = 'Convert and preview colors (hex, rgb, hsl)';

    author = DefaultLibraryAuthor;

    allowUnlistedCommands = true;

    valueRequired = true;

    metadata?: CliProcessorMetadata = {
        icon: '🎨',
        module: 'misc',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;
        const input = (command.value || '').trim();

        let r: number, g: number, b: number;

        try {
            if (input.startsWith('#')) {
                [r, g, b] = this.parseHex(input);
            } else if (input.startsWith('rgb')) {
                [r, g, b] = this.parseRgb(input);
            } else if (input.startsWith('hsl')) {
                [r, g, b] = this.hslToRgb(...this.parseHsl(input));
            } else if (/^[0-9a-fA-F]{3,8}$/.test(input)) {
                [r, g, b] = this.parseHex('#' + input);
            } else {
                writer.writeError(
                    'Unrecognized color format. Use hex (#ff0000), rgb(255,0,0), or hsl(0,100%,50%)',
                );
                context.process.exit(-1);
                return;
            }
        } catch {
            writer.writeError('Invalid color value');
            context.process.exit(-1);
            return;
        }

        const hex = this.rgbToHex(r, g, b);
        const [h, s, l] = this.rgbToHsl(r, g, b);

        // Color preview using ANSI true color
        const preview = `\x1b[48;2;${r};${g};${b}m      \x1b[0m`;

        writer.writeln(`${preview}`);
        writer.writeln(
            `  ${writer.wrapInColor('HEX:', CliForegroundColor.Cyan)}  ${hex}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('RGB:', CliForegroundColor.Cyan)}  rgb(${r}, ${g}, ${b})`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('HSL:', CliForegroundColor.Cyan)}  hsl(${h}, ${s}%, ${l}%)`,
        );

        context.process.output({ hex, rgb: { r, g, b }, hsl: { h, s, l } });
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Convert between color formats and preview colors');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('color <value>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln('📝 Supported formats:');
        writer.writeln(
            `  color #ff6600                    ${writer.wrapInColor('# Hex', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  color ff6600                     ${writer.wrapInColor('# Hex without #', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  color rgb(255,102,0)             ${writer.wrapInColor('# RGB', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  color hsl(24,100%,50%)           ${writer.wrapInColor('# HSL', CliForegroundColor.Green)}`,
        );
    }

    private parseHex(hex: string): [number, number, number] {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        return [
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16),
        ];
    }

    private parseRgb(input: string): [number, number, number] {
        const match = input.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (!match) throw new Error('Invalid RGB');
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }

    private parseHsl(input: string): [number, number, number] {
        const match = input.match(
            /(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/,
        );
        if (!match) throw new Error('Invalid HSL');
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }

    private rgbToHex(r: number, g: number, b: number): string {
        return (
            '#' +
            [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
        );
    }

    private rgbToHsl(
        r: number,
        g: number,
        b: number,
    ): [number, number, number] {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                    break;
                case g:
                    h = ((b - r) / d + 2) / 6;
                    break;
                case b:
                    h = ((r - g) / d + 4) / 6;
                    break;
            }
        }

        return [
            Math.round(h * 360),
            Math.round(s * 100),
            Math.round(l * 100),
        ];
    }

    private hslToRgb(
        h: number,
        s: number,
        l: number,
    ): [number, number, number] {
        h /= 360;
        s /= 100;
        l /= 100;

        let r: number, g: number, b: number;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
}

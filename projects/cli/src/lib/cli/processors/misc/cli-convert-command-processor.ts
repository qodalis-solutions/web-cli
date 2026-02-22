import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

type ConversionMap = Record<string, Record<string, number>>;

const lengthUnits: ConversionMap = {
    m: { m: 1, km: 0.001, cm: 100, mm: 1000, mi: 0.000621371, ft: 3.28084, in: 39.3701, yd: 1.09361 },
    km: { m: 1000, km: 1, cm: 100000, mm: 1000000, mi: 0.621371, ft: 3280.84, in: 39370.1, yd: 1093.61 },
    cm: { m: 0.01, km: 0.00001, cm: 1, mm: 10, mi: 0.00000621371, ft: 0.0328084, in: 0.393701, yd: 0.0109361 },
    mm: { m: 0.001, km: 0.000001, cm: 0.1, mm: 1, mi: 6.2137e-7, ft: 0.00328084, in: 0.0393701, yd: 0.00109361 },
    mi: { m: 1609.34, km: 1.60934, cm: 160934, mm: 1609340, mi: 1, ft: 5280, in: 63360, yd: 1760 },
    ft: { m: 0.3048, km: 0.0003048, cm: 30.48, mm: 304.8, mi: 0.000189394, ft: 1, in: 12, yd: 0.333333 },
    in: { m: 0.0254, km: 0.0000254, cm: 2.54, mm: 25.4, mi: 0.0000157828, ft: 0.0833333, in: 1, yd: 0.0277778 },
    yd: { m: 0.9144, km: 0.0009144, cm: 91.44, mm: 914.4, mi: 0.000568182, ft: 3, in: 36, yd: 1 },
};

const weightUnits: ConversionMap = {
    kg: { kg: 1, g: 1000, mg: 1000000, lb: 2.20462, oz: 35.274, t: 0.001 },
    g: { kg: 0.001, g: 1, mg: 1000, lb: 0.00220462, oz: 0.035274, t: 0.000001 },
    mg: { kg: 0.000001, g: 0.001, mg: 1, lb: 0.00000220462, oz: 0.000035274, t: 1e-9 },
    lb: { kg: 0.453592, g: 453.592, mg: 453592, lb: 1, oz: 16, t: 0.000453592 },
    oz: { kg: 0.0283495, g: 28.3495, mg: 28349.5, lb: 0.0625, oz: 1, t: 0.0000283495 },
    t: { kg: 1000, g: 1000000, mg: 1000000000, lb: 2204.62, oz: 35274, t: 1 },
};

const dataUnits: ConversionMap = {
    b: { b: 1, kb: 1 / 1024, mb: 1 / (1024 ** 2), gb: 1 / (1024 ** 3), tb: 1 / (1024 ** 4) },
    kb: { b: 1024, kb: 1, mb: 1 / 1024, gb: 1 / (1024 ** 2), tb: 1 / (1024 ** 3) },
    mb: { b: 1024 ** 2, kb: 1024, mb: 1, gb: 1 / 1024, tb: 1 / (1024 ** 2) },
    gb: { b: 1024 ** 3, kb: 1024 ** 2, mb: 1024, gb: 1, tb: 1 / 1024 },
    tb: { b: 1024 ** 4, kb: 1024 ** 3, mb: 1024 ** 2, gb: 1024, tb: 1 },
};

interface ConversionCategory {
    name: string;
    units: ConversionMap;
    unitNames: Record<string, string>;
}

const categories: ConversionCategory[] = [
    {
        name: 'length',
        units: lengthUnits,
        unitNames: { m: 'meters', km: 'kilometers', cm: 'centimeters', mm: 'millimeters', mi: 'miles', ft: 'feet', in: 'inches', yd: 'yards' },
    },
    {
        name: 'weight',
        units: weightUnits,
        unitNames: { kg: 'kilograms', g: 'grams', mg: 'milligrams', lb: 'pounds', oz: 'ounces', t: 'tonnes' },
    },
    {
        name: 'data',
        units: dataUnits,
        unitNames: { b: 'bytes', kb: 'kilobytes', mb: 'megabytes', gb: 'gigabytes', tb: 'terabytes' },
    },
];

export class CliConvertCommandProcessor implements ICliCommandProcessor {
    command = 'convert';

    aliases = ['conv'];

    description = 'Convert between units (length, weight, temperature, data)';

    author = DefaultLibraryAuthor;

    allowUnlistedCommands = true;

    valueRequired = true;

    metadata?: CliProcessorMetadata = {
        icon: '📐',
        module: 'misc',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;
        const input = (command.value || '').trim();

        // Parse: "100 km to mi" or "100km mi" or "32 c to f"
        const match = input.match(
            /^([\d.]+)\s*([a-zA-Z°]+)\s+(?:to\s+)?([a-zA-Z°]+)$/i,
        );

        if (!match) {
            writer.writeError(
                'Usage: convert <value> <from> to <to>',
            );
            writer.writeInfo('Example: convert 100 km to mi');
            context.process.exit(-1);
            return;
        }

        const value = parseFloat(match[1]);
        const fromUnit = match[2].toLowerCase();
        const toUnit = match[3].toLowerCase();

        if (isNaN(value)) {
            writer.writeError('Invalid number');
            context.process.exit(-1);
            return;
        }

        // Temperature special case
        if (this.isTemperatureUnit(fromUnit) && this.isTemperatureUnit(toUnit)) {
            const result = this.convertTemperature(value, fromUnit, toUnit);
            if (result !== null) {
                const rounded = Math.round(result * 1000) / 1000;
                writer.writeln(
                    `  ${value} ${this.tempLabel(fromUnit)} = ${writer.wrapInColor(String(rounded), CliForegroundColor.Cyan)} ${this.tempLabel(toUnit)}`,
                );
                context.process.output(rounded);
                return;
            }
        }

        // Standard unit conversion
        for (const category of categories) {
            if (category.units[fromUnit] && category.units[fromUnit][toUnit] !== undefined) {
                const result = value * category.units[fromUnit][toUnit];
                const rounded = Math.round(result * 1000000) / 1000000;
                const fromName = category.unitNames[fromUnit] || fromUnit;
                const toName = category.unitNames[toUnit] || toUnit;
                writer.writeln(
                    `  ${value} ${fromName} = ${writer.wrapInColor(String(rounded), CliForegroundColor.Cyan)} ${toName}`,
                );
                context.process.output(rounded);
                return;
            }
        }

        writer.writeError(`Cannot convert from "${fromUnit}" to "${toUnit}"`);
        writer.writeln();
        writer.writeInfo('Supported units:');
        writer.writeln('  Length: m, km, cm, mm, mi, ft, in, yd');
        writer.writeln('  Weight: kg, g, mg, lb, oz, t');
        writer.writeln('  Temperature: c, f, k');
        writer.writeln('  Data: b, kb, mb, gb, tb');
        context.process.exit(-1);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Convert between various units of measurement');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('convert <value> <from> to <to>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  convert 100 km to mi             ${writer.wrapInColor('# → 62.1371 miles', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  convert 72 f to c                ${writer.wrapInColor('# → 22.222 celsius', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  convert 1024 mb to gb            ${writer.wrapInColor('# → 1 gigabytes', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  convert 5.5 lb to kg             ${writer.wrapInColor('# → 2.494 kilograms', CliForegroundColor.Green)}`,
        );
        writer.writeln();
        writer.writeln('📐 Supported:');
        writer.writeln('  Length: m, km, cm, mm, mi, ft, in, yd');
        writer.writeln('  Weight: kg, g, mg, lb, oz, t');
        writer.writeln('  Temperature: c, f, k');
        writer.writeln('  Data: b, kb, mb, gb, tb');
    }

    private isTemperatureUnit(unit: string): boolean {
        return ['c', 'f', 'k', '°c', '°f', '°k'].includes(unit);
    }

    private tempLabel(unit: string): string {
        const u = unit.replace('°', '');
        return { c: '°C', f: '°F', k: 'K' }[u] || unit;
    }

    private convertTemperature(
        value: number,
        from: string,
        to: string,
    ): number | null {
        const f = from.replace('°', '');
        const t = to.replace('°', '');

        // Convert to Celsius first
        let celsius: number;
        switch (f) {
            case 'c': celsius = value; break;
            case 'f': celsius = (value - 32) * 5 / 9; break;
            case 'k': celsius = value - 273.15; break;
            default: return null;
        }

        // Convert from Celsius to target
        switch (t) {
            case 'c': return celsius;
            case 'f': return celsius * 9 / 5 + 32;
            case 'k': return celsius + 273.15;
            default: return null;
        }
    }
}

import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    DefaultLibraryAuthor,
    CliForegroundColor,
    ICliCommandChildProcessor,
} from '@qodalis/cli-core';
import { parseChartInput, renderBarChart, renderLineChart, renderSparkline } from '../chart-utils';
import { LIBRARY_VERSION } from '../version';

export class CliChartCommandProcessor implements ICliCommandProcessor {
    command = 'chart';
    description = 'Render ASCII charts from piped data (numbers or key:value pairs)';
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    metadata: CliProcessorMetadata = {
        icon: CliIcon.Growth,
        module: 'chart',
    };

    processors: ICliCommandChildProcessor[] = [
        {
            command: 'bar',
            description: 'Horizontal bar chart. Pipe numbers or key:value pairs.',
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const raw = cmd.value || (typeof cmd.data === 'string' ? cmd.data : '') || '';
                const data = parseChartInput(raw);
                if (!data.length) {
                    context.writer.writeError('No data. Pipe numbers or key:value pairs.');
                    return;
                }
                const width = Math.min((context.terminal?.cols ?? 80) - 20, 60);
                const lines = renderBarChart(data, width);
                for (const line of lines) {
                    context.writer.writeln(
                        context.writer.wrapInColor(line, CliForegroundColor.Cyan),
                    );
                }
                context.process.output(lines);
            },
            writeDescription: (context: ICliExecutionContext) => {
                const { writer } = context;
                writer.writeln('Render a horizontal ASCII bar chart from piped data.');
                writer.writeln();
                writer.writeln('Usage:');
                writer.writeln(
                    `  ${writer.wrapInColor('echo "10\\n20\\n30" | chart bar', CliForegroundColor.Cyan)}`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('echo "Jan:100\\nFeb:200\\nMar:150" | chart bar', CliForegroundColor.Cyan)}`,
                );
            },
        },
        {
            command: 'line',
            description: 'Line chart. Pipe numbers or key:value pairs.',
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const raw = cmd.value || (typeof cmd.data === 'string' ? cmd.data : '') || '';
                const data = parseChartInput(raw);
                if (!data.length) {
                    context.writer.writeError('No data. Pipe numbers or key:value pairs.');
                    return;
                }
                const width = Math.min((context.terminal?.cols ?? 80) - 10, 60);
                const lines = renderLineChart(data, width);
                for (const line of lines) {
                    context.writer.writeln(line);
                }
                const labels = data.map((d) => d.label.slice(0, 3));
                context.writer.writeln('       ' + labels.join('  '));
                context.process.output(lines);
            },
            writeDescription: (context: ICliExecutionContext) => {
                const { writer } = context;
                writer.writeln('Render an ASCII line/scatter chart from piped data.');
                writer.writeln();
                writer.writeln('Usage:');
                writer.writeln(
                    `  ${writer.wrapInColor('echo "Jan:100\\nFeb:200\\nMar:150" | chart line', CliForegroundColor.Cyan)}`,
                );
            },
        },
        {
            command: 'sparkline',
            description: 'Single-line sparkline. Pipe numbers or key:value pairs.',
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const raw = cmd.value || (typeof cmd.data === 'string' ? cmd.data : '') || '';
                const data = parseChartInput(raw);
                if (!data.length) {
                    context.writer.writeError('No data. Pipe numbers or key:value pairs.');
                    return;
                }
                const spark = renderSparkline(data);
                context.writer.writeln(spark);
                context.process.output(spark);
            },
            writeDescription: (context: ICliExecutionContext) => {
                const { writer } = context;
                writer.writeln('Render a compact single-line sparkline from piped data.');
                writer.writeln();
                writer.writeln('Usage:');
                writer.writeln(
                    `  ${writer.wrapInColor('echo "1\\n4\\n9\\n16\\n25" | chart sparkline', CliForegroundColor.Cyan)}`,
                );
            },
        },
    ];

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        await context.executor.showHelp(_, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description!);
        writer.writeln();
        writer.writeln('Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('chart bar', CliForegroundColor.Cyan)}          Horizontal bar chart`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('chart line', CliForegroundColor.Cyan)}         Scatter/line chart`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('chart sparkline', CliForegroundColor.Cyan)}    Compact single-line sparkline`,
        );
        writer.writeln();
        writer.writeln('Examples:');
        writer.writeln(
            `  ${writer.wrapInColor('echo "10\\n20\\n30" | chart bar', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('echo "Jan:100\\nFeb:200" | chart line', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('echo "1\\n4\\n9\\n16" | chart sparkline', CliForegroundColor.Cyan)}`,
        );
    }
}

import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliCalCommandProcessor implements ICliCommandProcessor {
    command = 'cal';

    aliases = ['calendar'];

    description = 'Display a calendar';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata = {
        icon: '📅',
        module: 'misc',
    };

    parameters = [
        {
            name: 'month',
            aliases: ['m'],
            description: 'Month (1-12)',
            type: 'number' as const,
            required: false,
        },
        {
            name: 'year',
            aliases: ['y'],
            description: 'Year (e.g. 2024)',
            type: 'number' as const,
            required: false,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;
        const now = new Date();

        const month =
            parseInt(command.args['month'] || command.args['m']) ||
            now.getMonth() + 1;
        const year =
            parseInt(command.args['year'] || command.args['y']) ||
            now.getFullYear();

        if (month < 1 || month > 12) {
            writer.writeError('Month must be between 1 and 12');
            context.process.exit(-1);
            return;
        }

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
        ];

        const title = `${monthNames[month - 1]} ${year}`;
        const padding = Math.max(0, Math.floor((20 - title.length) / 2));

        writer.writeln(
            writer.wrapInColor(
                ' '.repeat(padding) + title,
                CliForegroundColor.Yellow,
            ),
        );
        writer.writeln(
            writer.wrapInColor('Su Mo Tu We Th Fr Sa', CliForegroundColor.Cyan),
        );

        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        const today = now.getDate();
        const isCurrentMonth =
            now.getMonth() + 1 === month && now.getFullYear() === year;

        let line = '   '.repeat(firstDay);
        for (let day = 1; day <= daysInMonth; day++) {
            const dayStr = String(day).padStart(2);
            if (isCurrentMonth && day === today) {
                line += `\x1b[7m${dayStr}\x1b[0m `;
            } else {
                line += dayStr + ' ';
            }

            if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
                writer.writeln(line);
                line = '';
            }
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Display a monthly calendar');
        writer.writeln('Current day is highlighted');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('cal', CliForegroundColor.Cyan)}                            Current month`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('cal --month=3 --year=2024', CliForegroundColor.Cyan)}      Specific month`,
        );
    }
}

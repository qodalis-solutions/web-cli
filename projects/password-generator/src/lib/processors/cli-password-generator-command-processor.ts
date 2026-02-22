import { Injectable } from '@angular/core';
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

@Injectable()
export class CliPasswordGeneratorCommandProcessor
    implements ICliCommandProcessor
{
    command = 'generate-password';

    description = 'Generate a secure password';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        requiredCoreVersion: '0.0.16',
        requiredCliVersion: '1.0.37',
    };

    parameters?: ICliCommandParameterDescriptor[] | undefined = [
        {
            name: 'length',
            description: 'Length of the password',
            type: 'number',
            required: false,
            defaultValue: 16,
        },
        {
            name: 'symbols',
            description: 'Include symbols (!@#$%)',
            type: 'boolean',
            required: false,
            defaultValue: false,
        },
        {
            name: 'uppercase',
            description: 'Include uppercase letters',
            type: 'boolean',
            required: false,
            defaultValue: true,
        },
        {
            name: 'numbers',
            description: 'Include numbers (0-9)',
            type: 'boolean',
            required: false,
            defaultValue: true,
        },
    ];

    constructor() {}

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const length =
            command.args['length'] || this.parameters![0].defaultValue;
        const useSymbols =
            command.args['symbols'] || this.parameters![1].defaultValue;
        const useUppercase =
            command.args['uppercase'] ?? this.parameters![2].defaultValue;
        const useNumbers =
            command.args['numbers'] ?? this.parameters![3].defaultValue;

        const password = this.generatePassword(
            length,
            useSymbols,
            useUppercase,
            useNumbers,
        );

        context.writer.writeSuccess(
            `Generated Password: ${context.writer.wrapInColor(password, CliForegroundColor.White)}`,
        );

        context.process.output(password);
    }

    private generatePassword(
        length: number,
        symbols: boolean,
        uppercase: boolean,
        numbers: boolean,
    ): string {
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const nums = '0123456789';
        const sym = '!@#$%^&*()_+[]{}|;:,.<>?';

        let chars = lower;

        if (uppercase) chars += upper;
        if (numbers) chars += nums;
        if (symbols) chars += sym;

        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return password;
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description!);
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('generate-password [options]', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln('⚙️  Options:');
        writer.writeln(`  ${writer.wrapInColor('--length=<n>', CliForegroundColor.Yellow)}          Password length (default: 16)`);
        writer.writeln(`  ${writer.wrapInColor('--symbols', CliForegroundColor.Yellow)}             Include symbols (!@#$%)`);
        writer.writeln(`  ${writer.wrapInColor('--uppercase', CliForegroundColor.Yellow)}           Include uppercase (default: true)`);
        writer.writeln(`  ${writer.wrapInColor('--numbers', CliForegroundColor.Yellow)}             Include numbers (default: true)`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  generate-password                            ${writer.wrapInColor('# 16-char password', CliForegroundColor.Green)}`);
        writer.writeln(`  generate-password --length=32 --symbols      ${writer.wrapInColor('# 32-char with symbols', CliForegroundColor.Green)}`);
    }
}

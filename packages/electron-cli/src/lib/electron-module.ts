import type {
    ICliModule,
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
} from '@qodalis/cli-core';
import { ICliFileTransferService_TOKEN } from '@qodalis/cli-core';
import { ElectronFileTransferService } from './services/electron-file-transfer.service';
import { ElectronClipboardService } from './services/electron-clipboard.service';

/**
 * Command processor that overrides the built-in `open` command to use
 * Electron's `shell.openExternal()` instead of `window.open()`.
 */
const electronOpenProcessor: ICliCommandProcessor = {
    command: 'open',
    description: 'Open a URL in the system default browser',
    acceptsRawInput: true,
    extendsProcessor: true,
    parameters: [
        {
            name: 'url',
            description: 'The URL to open',
            required: true,
            type: 'string',
        },
    ],
    async processCommand(command: CliProcessCommand, context) {
        const url = command.value?.trim() || command.args['url'];
        if (!url) {
            context.writer.writeError('Usage: open <url>');
            return;
        }

        try {
            await window.electronCliApi.openExternal(url);
            context.writer.writeln(`Opened ${url} in default browser`);
        } catch (err: any) {
            context.writer.writeError(`Failed to open URL: ${err.message}`);
        }
    },
};

/**
 * Electron integration module for the Qodalis CLI engine.
 *
 * Registers Electron-native implementations for:
 * - File transfer (native dialogs + real filesystem)
 * - Clipboard (Electron clipboard API)
 * - `open` command (shell.openExternal)
 *
 * Usage:
 * ```ts
 * import { electronModule } from '@qodalis/electron-cli';
 *
 * const engine = new CliEngine(container, options);
 * engine.registerModule(electronModule);
 * engine.start();
 * ```
 */
export const electronModule: ICliModule = {
    apiVersion: 2,
    name: '@qodalis/electron-cli',
    version: '1.0.0',
    description: 'Electron-native file transfer, clipboard, and shell integration',

    services: [
        {
            provide: ICliFileTransferService_TOKEN,
            useValue: new ElectronFileTransferService(),
        },
    ],

    processors: [electronOpenProcessor],

    async onInit(context: ICliExecutionContext) {
        // Replace clipboard with Electron-native implementation
        (context as any).clipboard = new ElectronClipboardService();
    },
};

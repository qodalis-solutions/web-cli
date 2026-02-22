import { Inject, Injectable } from '@angular/core';
import { CliProcessorMetadata, DefaultLibraryAuthor } from '@qodalis/cli-core';
import {
    CliProcessCommand,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliPingServerService,
} from '@qodalis/cli-core';
import { ICliPingServerService_TOKEN } from '../tokens';

@Injectable()
export class CliPingCommandProcessor implements ICliCommandProcessor {
    command = 'ping';

    aliases = ['pong'];

    description?: string | undefined = 'Pings the server';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🏓',
    };

    constructor(
        @Inject(ICliPingServerService_TOKEN)
        private pingServerService: ICliPingServerService,
    ) {}

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Pings the server to check connectivity');
        context.writer.writeln();
        context.writer.writeln('📡 Usage:');
        context.writer.writeln('  ping');
        context.writer.writeln();
        context.writer.writeln('💡 Returns "pong" if the server is reachable');
    }

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.spinner?.show();
        context?.spinner?.setText('Pinging server...');
        try {
            await this.pingServerService.ping();
            context.spinner?.hide();
            context.writer.writeln('pong');
        } catch {
            context.spinner?.hide();
            context.writer.writeError('Failed to ping the server');
        }
    }
}

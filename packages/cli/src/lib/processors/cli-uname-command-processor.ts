import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION as Core_Version } from '@qodalis/cli-core';
import { LIBRARY_VERSION as CLI_Version } from '../version';

export class CliUnameCommandProcessor implements ICliCommandProcessor {
    command = 'uname';

    aliases = ['sysinfo'];

    description?: string | undefined =
        'Prints detailed system and browser information';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: CliIcon.Flame,
        module: 'misc',
    };

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(
            t.t('cli.uname.long_description', 'Prints detailed system and browser information including:'),
        );
        writer.writeln(`  💾 ${t.t('cli.uname.cli_versions', 'CLI core and library versions')}`);
        writer.writeln(
            `  🌐 ${t.t('cli.uname.browser_info', 'Browser name, version, user agent, language, and platform')}`,
        );
        writer.writeln(`  🖥  ${t.t('cli.uname.os', 'Operating system')}`);
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('uname', CliForegroundColor.Cyan)}`,
        );
    }

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;

        function writeItem(key: string, value: string): void {
            writer.writeln(
                `- ${writer.wrapInColor(key, CliForegroundColor.Cyan)}: ${value}`,
            );
        }

        writer.writeInfo('CLI:');
        writeItem('Core version', Core_Version);
        writeItem('Cli version', CLI_Version);

        writer.writeln();

        if (typeof navigator !== 'undefined') {
            writer.writeInfo('Browser Information:');

            writeItem('User Agent', navigator.userAgent);
            writeItem('Language', navigator.language);
            writeItem('Platform', navigator.platform);

            // Extracting more detailed information from userAgent
            const browserDetails = this.parseUserAgent(navigator.userAgent);
            writeItem('Browser', browserDetails.browserName);
            writeItem('Version', browserDetails.version);
            writeItem('OS', browserDetails.os);
        } else {
            writer.writeError(
                'Browser information is not available in this environment.',
            );
        }
    }

    parseUserAgent(userAgent: string): {
        browserName: string;
        version: string;
        os: string;
    } {
        let browserName = 'Unknown';
        let version = 'Unknown';
        let os = 'Unknown';

        // Simple parsing logic for demonstration purposes
        if (userAgent.includes('Chrome')) {
            browserName = 'Chrome';
            version = userAgent.match(/Chrome\/([\d.]+)/)?.[1] || 'Unknown';
        } else if (userAgent.includes('Firefox')) {
            browserName = 'Firefox';
            version = userAgent.match(/Firefox\/([\d.]+)/)?.[1] || 'Unknown';
        } else if (
            userAgent.includes('Safari') &&
            !userAgent.includes('Chrome')
        ) {
            browserName = 'Safari';
            version = userAgent.match(/Version\/([\d.]+)/)?.[1] || 'Unknown';
        } else if (
            userAgent.includes('MSIE') ||
            userAgent.includes('Trident')
        ) {
            browserName = 'Internet Explorer';
            version =
                userAgent.match(/(?:MSIE |rv:)([\d.]+)/)?.[1] || 'Unknown';
        }

        if (userAgent.includes('Windows')) {
            os = 'Windows';
        } else if (userAgent.includes('Mac OS')) {
            os = 'Mac OS';
        } else if (userAgent.includes('Linux')) {
            os = 'Linux';
        } else if (userAgent.includes('Android')) {
            os = 'Android';
        } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
            os = 'iOS';
        }

        return { browserName, version, os };
    }
}

import { Component, ViewChild, ElementRef } from '@angular/core';
import { CliLogLevel, CliOptions, ICliModule } from '@qodalis/cli-core';
import { usersModule } from '@qodalis/cli-users';
import { guidModule } from '@qodalis/cli-guid';
import { regexModule } from '@qodalis/cli-regex';
import { textToImageModule } from '@qodalis/cli-text-to-image';
import { speedTestModule } from '@qodalis/cli-speed-test';
import { browserStorageModule } from '@qodalis/cli-browser-storage';
import { stringModule } from '@qodalis/cli-string';
import { todoModule } from '@qodalis/cli-todo';
import { curlModule } from '@qodalis/cli-curl';
import { passwordGeneratorModule } from '@qodalis/cli-password-generator';
import { qrModule } from '@qodalis/cli-qr';
import { yesnoModule } from '@qodalis/cli-yesno';
import { serverLogsModule } from '@qodalis/cli-server-logs';
import { filesModule } from '@qodalis/cli-files';

interface Feature {
    icon: string;
    title: string;
    description: string;
}

interface PluginInfo {
    name: string;
    command: string;
    description: string;
}

interface CommandGroup {
    label: string;
    commands: string[];
}

interface AdvancedFeature {
    icon: string;
    title: string;
    description: string;
    example: string;
}

type Framework = 'angular' | 'react' | 'vue';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.sass'],
})
export class AppComponent {
    title = 'Qodalis CLI';

    @ViewChild('terminalSection') terminalSection!: ElementRef;

    modules: ICliModule[] = [
        usersModule,
        guidModule,
        regexModule,
        textToImageModule,
        speedTestModule,
        browserStorageModule,
        stringModule,
        todoModule,
        curlModule,
        passwordGeneratorModule,
        qrModule,
        yesnoModule,
        serverLogsModule,
        filesModule,
    ];

    options: CliOptions = {
        logLevel: CliLogLevel.DEBUG,
    };

    activeFramework: Framework = 'angular';

    get installCommand(): string {
        switch (this.activeFramework) {
            case 'react':
                return 'npm install @qodalis/react-cli';
            case 'vue':
                return 'npm install @qodalis/vue-cli';
            default:
                return 'npm install @qodalis/angular-cli';
        }
    }

    frameworkSnippets: Record<
        Framework,
        { imports: string; template: string }
    > = {
        angular: {
            imports: `import { CliModule } from '@qodalis/angular-cli';
import { guidModule } from '@qodalis/cli-guid';
import { filesModule } from '@qodalis/cli-files';

@NgModule({
  imports: [CliModule],
})
export class AppModule {}`,
            template: `<cli
  [modules]="[guidModule, filesModule]"
  height="400px"
/>

<cli-panel
  [modules]="[guidModule, filesModule]"
/>`,
        },
        react: {
            imports: `import { Cli, CliPanel } from '@qodalis/react-cli';
import { guidModule } from '@qodalis/cli-guid';
import { filesModule } from '@qodalis/cli-files';`,
            template: `<Cli
  modules={[guidModule, filesModule]}
  height="400px"
/>

<CliPanel
  modules={[guidModule, filesModule]}
/>`,
        },
        vue: {
            imports: `import { Cli, CliPanel } from '@qodalis/vue-cli';
import { guidModule } from '@qodalis/cli-guid';
import { filesModule } from '@qodalis/cli-files';`,
            template: `<Cli
  :modules="[guidModule, filesModule]"
  height="400px"
/>

<CliPanel
  :modules="[guidModule, filesModule]"
/>`,
        },
    };

    features: Feature[] = [
        {
            icon: '\u29C9',
            title: 'Plugin Ecosystem',
            description:
                'Extend functionality with drop-in plugins. 13 official plugins included, or create your own with one command.',
        },
        {
            icon: '\u2261',
            title: 'Tabs & Split Panes',
            description:
                'Multiple terminals in tabs with draggable split panes. Rename, duplicate, and manage sessions.',
        },
        {
            icon: '\u25D0',
            title: 'Fully Themeable',
            description:
                "CSS custom properties for every surface. Match your app's design system with zero friction.",
        },
        {
            icon: '\u21E5',
            title: 'Autocomplete & History',
            description:
                'Tab completion, command history navigation, and inline suggestions out of the box.',
        },
        {
            icon: '\u2B21',
            title: 'Multi-Framework',
            description:
                'Native support for Angular, React, and Vue. Same plugin ecosystem, same API across frameworks.',
        },
        {
            icon: '\uD83D\uDCC1',
            title: 'Virtual Filesystem',
            description:
                'Built-in ls, cat, mkdir, nano commands. A complete in-browser filesystem for your terminal.',
        },
        {
            icon: '\u21C6',
            title: 'Command Piping',
            description:
                'Chain commands with pipes. Stream output between processors like a real shell.',
        },
        {
            icon: '\u2699',
            title: 'Configuration System',
            description:
                'Persistent key-value config store. Commands can read and write settings at runtime.',
        },
    ];

    builtInGroups: CommandGroup[] = [
        {
            label: 'Dev Tools',
            commands: ['curl', 'json', 'regex test', 'base64', 'speed-test'],
        },
        {
            label: 'Utilities',
            commands: [
                'guid generate',
                'password generate',
                'qr generate',
                'string',
                'text-to-image',
            ],
        },
        {
            label: 'System',
            commands: ['help', 'version', 'clear', 'history', 'echo', 'date'],
        },
        {
            label: 'Editors & Files',
            commands: ['nano', 'ls', 'cat', 'mkdir', 'touch', 'rm'],
        },
        {
            label: 'Packages',
            commands: ['npm install', 'npm list', 'npm remove'],
        },
        {
            label: 'Configuration',
            commands: [
                'config set',
                'config get',
                'config list',
                'config delete',
            ],
        },
    ];

    advancedFeatures: AdvancedFeature[] = [
        {
            icon: '\uD83C\uDF10',
            title: 'Server Integration',
            description:
                'Connect to a .NET or Node backend via REST or WebSocket. Execute server-side commands from the browser terminal.',
            example: 'server connect ws://localhost:8046/ws/cli',
        },
        {
            icon: '\u2753',
            title: 'Interactive Input',
            description:
                'Yes/no prompts, confirmations, and user input flows. Build interactive CLI wizards in the browser.',
            example: 'yesno "Deploy to production?"',
        },
        {
            icon: '\uD83D\uDCE6',
            title: 'Runtime Packages',
            description:
                'Install CLI plugins at runtime with npm install. Users can extend the terminal without rebuilding.',
            example: 'npm install @qodalis/cli-guid',
        },
        {
            icon: '\u270F\uFE0F',
            title: 'Nano Editor',
            description:
                'A built-in text editor in the browser terminal. Create and edit files without leaving the CLI.',
            example: 'nano readme.txt',
        },
    ];

    plugins: PluginInfo[] = [
        {
            name: 'GUID',
            command: 'guid generate',
            description: 'Generate and validate UUIDs',
        },
        {
            name: 'Regex',
            command: 'regex test',
            description: 'Test and debug regular expressions',
        },
        {
            name: 'QR Code',
            command: 'qr generate',
            description: 'Generate QR codes from text',
        },
        {
            name: 'Speed Test',
            command: 'speed-test',
            description: 'Measure network performance',
        },
        {
            name: 'cURL',
            command: 'curl',
            description: 'Make HTTP requests from the terminal',
        },
        {
            name: 'Password',
            command: 'password generate',
            description: 'Generate secure passwords',
        },
        {
            name: 'String',
            command: 'string',
            description: 'Encode, decode, and transform text',
        },
        {
            name: 'Todo',
            command: 'todo',
            description: 'Manage tasks from the command line',
        },
        {
            name: 'Storage',
            command: 'storage',
            description: 'Inspect browser local/session storage',
        },
        {
            name: 'Text to Image',
            command: 'text-to-image',
            description: 'Render text as images',
        },
        {
            name: 'Files',
            command: 'ls, cat, nano',
            description: 'Virtual filesystem with editor',
        },
        {
            name: 'Yes/No',
            command: 'yesno',
            description: 'Interactive yes/no prompts',
        },
        {
            name: 'Server Logs',
            command: 'logs',
            description: 'Stream and filter server logs',
        },
    ];

    copied = false;

    setFramework(fw: Framework): void {
        this.activeFramework = fw;
    }

    scrollToTerminal(): void {
        this.terminalSection?.nativeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    }

    copyInstall(): void {
        navigator.clipboard.writeText(this.installCommand).then(() => {
            this.copied = true;
            setTimeout(() => (this.copied = false), 2000);
        });
    }
}

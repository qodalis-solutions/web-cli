import { Component, ViewChild, ElementRef } from '@angular/core';
import { CliLogLevel, CliOptions } from '@qodalis/cli-core';

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

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.sass'],
})
export class AppComponent {
    title = 'Qodalis CLI';

    @ViewChild('terminalSection') terminalSection!: ElementRef;

    options: CliOptions = {
        welcomeMessage: {
            show: 'always',
        },
        usersModule: {
            enabled: true,
        },
        logLevel: CliLogLevel.DEBUG,
    };

    features: Feature[] = [
        {
            icon: '\u29C9',
            title: 'Plugin Ecosystem',
            description:
                'Extend functionality with drop-in Angular modules. GUID, regex, QR codes, speed tests, and more.',
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
                'CSS custom properties for every surface. Match your app\'s design system with zero friction.',
        },
        {
            icon: '\u21E5',
            title: 'Autocomplete & History',
            description:
                'Tab completion, command history navigation, and inline suggestions out of the box.',
        },
    ];

    plugins: PluginInfo[] = [
        { name: 'GUID', command: 'guid generate', description: 'Generate and validate UUIDs' },
        { name: 'Regex', command: 'regex test', description: 'Test and debug regular expressions' },
        { name: 'QR Code', command: 'qr generate', description: 'Generate QR codes from text' },
        { name: 'Speed Test', command: 'speed-test', description: 'Measure network performance' },
        { name: 'cURL', command: 'curl', description: 'Make HTTP requests from the terminal' },
        { name: 'Password', command: 'password generate', description: 'Generate secure passwords' },
        { name: 'String', command: 'string', description: 'Encode, decode, and transform text' },
        { name: 'Todo', command: 'todo', description: 'Manage tasks from the command line' },
        { name: 'Storage', command: 'storage', description: 'Inspect browser local/session storage' },
        { name: 'Text to Image', command: 'text-to-image', description: 'Render text as images' },
    ];

    installCommand = 'npm install @qodalis/angular-cli @qodalis/cli-core';
    copied = false;

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

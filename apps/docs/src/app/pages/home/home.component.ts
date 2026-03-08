import { Component, ElementRef, ViewChild } from '@angular/core';
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
import { snakeModule } from '@qodalis/cli-snake';
import { tetrisModule } from '@qodalis/cli-tetris';
import { game2048Module } from '@qodalis/cli-2048';
import { minesweeperModule } from '@qodalis/cli-minesweeper';
import { wordleModule } from '@qodalis/cli-wordle';
import { sudokuModule } from '@qodalis/cli-sudoku';
import { chartModule } from '@qodalis/cli-chart';
import { cronModule } from '@qodalis/cli-cron';
import { csvModule } from '@qodalis/cli-csv';
import { markdownModule } from '@qodalis/cli-markdown';
import { scpModule } from '@qodalis/cli-scp';
import { stopwatchModule } from '@qodalis/cli-stopwatch';
import { wgetModule } from '@qodalis/cli-wget';

import {
    UTILITY_PLUGINS,
    GAME_PLUGINS,
    LANGUAGE_PACKS,
    PluginData,
} from '../../data/plugins';
import { BUILT_IN_GROUPS, TOTAL_COMMAND_COUNT, CommandGroup } from '../../data/commands';

export interface Feature {
    icon: string;
    title: string;
    description: string;
}

export interface PluginInfo {
    id: string;
    name: string;
    command: string;
    description: string;
}

export interface AdvancedFeature {
    icon: string;
    title: string;
    description: string;
    example: string;
}

export type Framework = 'angular' | 'react' | 'vue';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.sass'],
})
export class HomeComponent {
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
        snakeModule,
        tetrisModule,
        game2048Module,
        minesweeperModule,
        wordleModule,
        sudokuModule,
        chartModule,
        cronModule,
        csvModule,
        markdownModule,
        scpModule,
        stopwatchModule,
        wgetModule,
    ];

    options: CliOptions = {
        logLevel: CliLogLevel.DEBUG,
    };

    activeFramework: Framework = 'angular';
    copied = false;

    builtInGroups: CommandGroup[] = BUILT_IN_GROUPS;
    totalCommandCount: number = TOTAL_COMMAND_COUNT;

    utilityPlugins: PluginInfo[] = UTILITY_PLUGINS.map(this.toPluginInfo);
    gamePlugins: PluginInfo[] = GAME_PLUGINS.map(this.toPluginInfo);
    languagePacks: PluginInfo[] = LANGUAGE_PACKS.map(this.toPluginInfo);

    features: Feature[] = [
        {
            icon: '\u29C9',
            title: 'Plugin Ecosystem',
            description: `Extend functionality with drop-in plugins. ${UTILITY_PLUGINS.length + GAME_PLUGINS.length} official plugins included, or create your own with one command.`,
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

    frameworkSnippets: Record<Framework, { imports: string; template: string }> = {
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

    get installCommand(): string {
        switch (this.activeFramework) {
            case 'angular':
                return 'npm install @qodalis/angular-cli';
            case 'react':
                return 'npm install @qodalis/react-cli';
            case 'vue':
                return 'npm install @qodalis/vue-cli';
        }
    }

    setFramework(fw: Framework): void {
        this.activeFramework = fw;
    }

    scrollToTerminal(): void {
        this.terminalSection?.nativeElement?.scrollIntoView({
            behavior: 'smooth',
        });
    }

    copyInstall(): void {
        navigator.clipboard.writeText(this.installCommand);
        this.copied = true;
        setTimeout(() => (this.copied = false), 2000);
    }

    private toPluginInfo(p: PluginData): PluginInfo {
        return {
            id: p.id,
            name: p.name,
            command: p.command,
            description: p.description,
        };
    }
}

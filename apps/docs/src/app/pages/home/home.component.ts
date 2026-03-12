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
import { langEsModule } from '@qodalis/cli-lang-es';
import { langFrModule } from '@qodalis/cli-lang-fr';
import { langDeModule } from '@qodalis/cli-lang-de';
import { langPtModule } from '@qodalis/cli-lang-pt';
import { langItModule } from '@qodalis/cli-lang-it';
import { langJaModule } from '@qodalis/cli-lang-ja';
import { langKoModule } from '@qodalis/cli-lang-ko';
import { langZhModule } from '@qodalis/cli-lang-zh';
import { langRuModule } from '@qodalis/cli-lang-ru';
import { langRoModule } from '@qodalis/cli-lang-ro';

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

export type Framework = 'angular' | 'react' | 'vue' | 'vanilla';

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
        langEsModule,
        langFrModule,
        langDeModule,
        langPtModule,
        langItModule,
        langJaModule,
        langKoModule,
        langZhModule,
        langRuModule,
        langRoModule,
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
        { icon: '\u29C9', title: 'home.features.plugin-ecosystem.title', description: 'home.features.plugin-ecosystem.description' },
        { icon: '\u2261', title: 'home.features.tabs-panes.title', description: 'home.features.tabs-panes.description' },
        { icon: '\u25D0', title: 'home.features.themeable.title', description: 'home.features.themeable.description' },
        { icon: '\u21E5', title: 'home.features.autocomplete.title', description: 'home.features.autocomplete.description' },
        { icon: '\u2B21', title: 'home.features.multi-framework.title', description: 'home.features.multi-framework.description' },
        { icon: '\uD83D\uDCC1', title: 'home.features.virtual-fs.title', description: 'home.features.virtual-fs.description' },
        { icon: '\u21C6', title: 'home.features.piping.title', description: 'home.features.piping.description' },
        { icon: '\u2699', title: 'home.features.config.title', description: 'home.features.config.description' },
    ];

    advancedFeatures: AdvancedFeature[] = [
        { icon: '\uD83C\uDF10', title: 'home.advanced.server.title', description: 'home.advanced.server.description', example: 'server connect ws://localhost:8046/ws/cli' },
        { icon: '\u2753', title: 'home.advanced.input.title', description: 'home.advanced.input.description', example: 'yesno "Deploy to production?"' },
        { icon: '\uD83D\uDCE6', title: 'home.advanced.plugins.title', description: 'home.advanced.plugins.description', example: "import { guidModule } from '@qodalis/cli-guid';" },
        { icon: '\u270F\uFE0F', title: 'home.advanced.nano.title', description: 'home.advanced.nano.description', example: 'nano readme.txt' },
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
        vanilla: {
            imports: `import { CliEngine } from '@qodalis/cli';
import { guidModule } from '@qodalis/cli-guid';
import { filesModule } from '@qodalis/cli-files';`,
            template: `const engine = new CliEngine(
  document.getElementById('terminal')!,
  {
    welcomeMessage: { message: 'Welcome!', show: 'always' },
  },
);

engine.registerModules([guidModule, filesModule]);
await engine.start();`,
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
            case 'vanilla':
                return 'npm install @qodalis/cli';
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

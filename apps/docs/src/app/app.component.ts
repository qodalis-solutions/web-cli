import { Component, HostListener, ViewChild, effect, inject } from '@angular/core';
import { CliLogLevel, ICliModule } from '@qodalis/cli-core';
import { CliPanelComponent, CliPanelOptions } from '@qodalis/angular-cli';
import { PanelRefService } from './services/panel-ref.service';
import { ThemeService, ThemeMode } from './services/theme.service';
import { TranslateService } from '@ngx-translate/core';
import { LANGUAGES, Language, DEFAULT_LANG, LANG_STORAGE_KEY } from './data/languages';
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
import { jobsModule } from '@qodalis/cli-server-jobs';
import { loadLanguagePacks } from './lang-packs';

@Component({
    standalone: false,
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.sass'],
})
export class AppComponent {
    title = 'Qodalis CLI';

    readonly theme = inject(ThemeService);
    private panel?: CliPanelComponent;

    /** The panel renders once the language packs are in, after the first view check. */
    @ViewChild(CliPanelComponent)
    set panelComponent(panel: CliPanelComponent | undefined) {
        this.panel = panel;
        this.panelRef.panel = panel ?? null;
        panel?.setTheme(this.theme.scheme());
    }

    languages = LANGUAGES;
    currentLang: Language;
    langDropdownOpen = false;

    constructor(
        private translate: TranslateService,
        private panelRef: PanelRefService,
    ) {
        // The panel follows the site's light/dark scheme
        effect(() => this.panel?.setTheme(this.theme.scheme()));

        const browserLangPrefix = navigator.language?.split('-')[0];
        const supportedCodes = LANGUAGES.map((l) => l.code);
        const storedLang = localStorage.getItem(LANG_STORAGE_KEY);

        let langCode: string;
        if (storedLang && supportedCodes.includes(storedLang)) {
            langCode = storedLang;
        } else if (supportedCodes.includes(browserLangPrefix)) {
            langCode = browserLangPrefix;
        } else {
            langCode = DEFAULT_LANG;
        }

        this.translate.use(langCode);
        this.currentLang = LANGUAGES.find((l) => l.code === langCode) || LANGUAGES[0];
    }

    switchLang(lang: Language): void {
        this.translate.use(lang.code);
        this.currentLang = lang;
        localStorage.setItem(LANG_STORAGE_KEY, lang.code);
        this.langDropdownOpen = false;
    }

    toggleLangDropdown(): void {
        this.langDropdownOpen = !this.langDropdownOpen;
    }

    /** Label key of the theme button: names the current mode. */
    themeLabel(mode: ThemeMode): string {
        return `nav.theme.${mode}`;
    }

    @HostListener('document:click')
    @HostListener('document:keydown.escape')
    closeLangDropdown(): void {
        this.langDropdownOpen = false;
    }

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
        jobsModule,
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

    /** The terminal is created once the language packs (lazy chunks) are in. */
    modulesReady = false;

    readonly cliLanguagePacks = loadLanguagePacks().then((packs) => {
        this.modules = [...this.modules, ...packs];
        this.modulesReady = true;
    });

    options: CliPanelOptions = {
        logLevel: CliLogLevel.DEBUG,
        position: 'right',
        isHidden: true,
        theme: this.theme.scheme(),
    };
}

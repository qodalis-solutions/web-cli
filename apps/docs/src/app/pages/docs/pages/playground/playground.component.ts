import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    OnDestroy,
    ViewChild,
} from '@angular/core';
import { CliEngine } from '@qodalis/cli';
import { loadMonaco, Monaco } from './monaco-loader';
import { PLAYGROUND_EXAMPLES, PlaygroundExample } from './playground-examples';
import {
    coreExportNames,
    evaluatePlayground,
    missingCoreImports,
    PlaygroundError,
} from './playground-runner';
import {
    PLAYGROUND_PATH,
    playgroundUrl,
    readPlaygroundFragment,
} from '../../../../shared/playground-link';

const MODEL_URI = 'file:///playground.ts';
const CORE_TYPES_URL = '/assets/playground/types/cli-core/public-api.d.ts';
const DRAFT_KEY = 'qcli-docs-playground-draft';
const BUILD_DELAY_MS = 700;

type Status =
    | { kind: 'loading' }
    | { kind: 'ready'; ms: number; typeErrors: number }
    | { kind: 'paused' }
    | { kind: 'error'; title: string; detail: string };

@Component({
    standalone: false,
    selector: 'docs-playground',
    templateUrl: './playground.component.html',
    styleUrl: './playground.component.sass',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaygroundComponent implements AfterViewInit, OnDestroy {
    @ViewChild('editorHost') editorHost!: ElementRef<HTMLElement>;
    @ViewChild('terminalHost') terminalHost!: ElementRef<HTMLElement>;

    readonly examples = PLAYGROUND_EXAMPLES;
    exampleId = PLAYGROUND_EXAMPLES[0].id;
    commands = '';
    /** Rebuild after every change; off for code that came in a link until Run is pressed */
    liveRebuild = true;
    fromLink = false;
    status: Status = { kind: 'loading' };
    shareState: 'idle' | 'copied' | 'failed' = 'idle';

    private monaco?: Monaco;
    private editor?: Monaco;
    private model?: Monaco;
    private engine?: CliEngine;
    private buildTimer?: ReturnType<typeof setTimeout>;
    private draftTimer?: ReturnType<typeof setTimeout>;
    private shareTimer?: ReturnType<typeof setTimeout>;
    private buildId = 0;
    private destroyed = false;

    constructor(private readonly cdr: ChangeDetectorRef) {}

    async ngAfterViewInit(): Promise<void> {
        try {
            const [monaco, coreTypes, snippet] = await Promise.all([
                loadMonaco(),
                fetch(CORE_TYPES_URL).then((r) => (r.ok ? r.text() : '')),
                readPlaygroundFragment(location.hash),
            ]);
            if (this.destroyed) return;
            this.monaco = monaco;
            this.configureTypeScript(coreTypes);

            let code: string;
            if (snippet) {
                code = snippet.code;
                this.commands = snippet.commands ?? '';
                this.fromLink = true;
                this.liveRebuild = false;
                this.exampleId = '';
            } else {
                const draft = this.readDraft();
                const example = this.example(draft?.exampleId) ?? PLAYGROUND_EXAMPLES[0];
                this.exampleId = example.id;
                code = draft?.code ?? example.code;
                this.commands = draft?.commands ?? example.commands;
            }

            this.model = monaco.editor.createModel(code, 'typescript', monaco.Uri.parse(MODEL_URI));
            this.editor = monaco.editor.create(this.editorHost.nativeElement, {
                model: this.model,
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13,
                tabSize: 4,
                scrollBeyondLastLine: false,
                fixedOverflowWidgets: true,
            });
            this.model.onDidChangeContent(() => this.changed());

            if (snippet) {
                await this.addMissingImports(coreTypes);
                this.status = { kind: 'paused' };
                this.cdr.markForCheck();
            } else {
                await this.build();
            }
        } catch (e) {
            this.fail('The editor could not be loaded', e);
        }
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        clearTimeout(this.buildTimer);
        clearTimeout(this.draftTimer);
        clearTimeout(this.shareTimer);
        this.engine?.destroy();
        this.editor?.dispose();
        this.model?.dispose();
    }

    /** Run button: build now, and keep rebuilding on every change from here on. */
    async run(): Promise<void> {
        this.liveRebuild = true;
        this.fromLink = false;
        await this.build();
    }

    selectExample(id: string): void {
        const example = this.example(id);
        if (!example || !this.model) return;
        this.exampleId = id;
        this.commands = example.commands;
        this.fromLink = false;
        this.liveRebuild = true;
        history.replaceState(history.state, '', PLAYGROUND_PATH);
        this.model.setValue(example.code); // triggers a rebuild
    }

    resetExample(): void {
        this.selectExample(this.exampleId || PLAYGROUND_EXAMPLES[0].id);
    }

    commandsChanged(value: string): void {
        this.commands = value;
        this.changed();
    }

    async share(): Promise<void> {
        if (!this.model) return;
        const path = await playgroundUrl({ code: this.model.getValue(), commands: this.commands });
        history.replaceState(history.state, '', path);
        try {
            await navigator.clipboard.writeText(location.origin + path);
            this.shareState = 'copied';
        } catch {
            this.shareState = 'failed'; // the link is still in the address bar
        }
        this.cdr.markForCheck();
        clearTimeout(this.shareTimer);
        this.shareTimer = setTimeout(() => {
            this.shareState = 'idle';
            this.cdr.markForCheck();
        }, 2500);
    }

    private changed(): void {
        clearTimeout(this.draftTimer);
        this.draftTimer = setTimeout(() => this.saveDraft(), 500);
        if (!this.liveRebuild) return;
        clearTimeout(this.buildTimer);
        this.buildTimer = setTimeout(() => void this.build(), BUILD_DELAY_MS);
    }

    /** Compile, then replace the terminal with one running the new code. */
    private async build(): Promise<void> {
        if (!this.monaco || !this.model) return;
        const id = ++this.buildId;
        const started = performance.now();
        try {
            const getWorker = await this.monaco.typescript.getTypeScriptWorker();
            const worker = await getWorker(this.model.uri);
            const uri = this.model.uri.toString();
            const [syntax, semantic, output] = await Promise.all([
                worker.getSyntacticDiagnostics(uri),
                worker.getSemanticDiagnostics(uri),
                worker.getEmitOutput(uri),
            ]);
            if (id !== this.buildId || this.destroyed) return;

            if (syntax.length) {
                const first = syntax[0];
                const line = this.model.getPositionAt(first.start ?? 0).lineNumber;
                this.fail('Syntax error', `Line ${line}: ${this.message(first.messageText)}`);
                return;
            }
            const js: string | undefined = output.outputFiles?.find((f: { name: string }) =>
                f.name.endsWith('.js'),
            )?.text;
            if (!js) {
                this.fail('Nothing to run', 'The code could not be compiled.');
                return;
            }

            const modules = evaluatePlayground(js);
            await this.restartTerminal(id, modules);
            if (id !== this.buildId || this.destroyed) return;
            this.status = {
                kind: 'ready',
                ms: Math.round(performance.now() - started),
                typeErrors: semantic.length,
            };
            this.cdr.markForCheck();
        } catch (e) {
            if (id !== this.buildId || this.destroyed) return;
            this.fail(e instanceof PlaygroundError ? 'Nothing to run' : 'The code threw an error', e);
        }
    }

    private async restartTerminal(id: number, modules: Parameters<CliEngine['registerModules']>[0]): Promise<void> {
        this.engine?.destroy();
        const host = this.terminalHost.nativeElement;
        host.replaceChildren();
        const container = document.createElement('div');
        container.style.height = '100%';
        host.appendChild(container);

        // Just the prompt: no boot report, banner or animated greeting
        const engine = new CliEngine(container, {
            boot: { showLogs: false },
            welcome: false,
            wasmUrl: '/assets/wasm/qodalis_cli_wasm_bg.wasm',
        });
        engine.registerModules(modules);
        this.engine = engine;
        await engine.start();

        const lines = this.commands
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
        for (const line of lines) {
            if (id !== this.buildId || this.destroyed) return;
            await engine.execute(line);
        }
    }

    private configureTypeScript(coreTypes: string): void {
        const ts = this.monaco.typescript;
        ts.typescriptDefaults.setCompilerOptions({
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            strict: true,
            noImplicitAny: false,
            esModuleInterop: true,
            experimentalDecorators: true,
            allowNonTsExtensions: true,
        });
        if (coreTypes) {
            ts.typescriptDefaults.addExtraLib(coreTypes, 'file:///node_modules/@qodalis/cli-core/index.d.ts');
        }
        // The engine package is available at runtime; its types are not loaded
        ts.typescriptDefaults.addExtraLib("declare module '@qodalis/cli';", 'file:///node_modules/@types/qodalis-cli/index.d.ts');
    }

    /** Examples copied from the docs often leave out their imports: add the cli-core ones. */
    private async addMissingImports(coreTypes: string): Promise<void> {
        if (!coreTypes || !this.model) return;
        const getWorker = await this.monaco.typescript.getTypeScriptWorker();
        const worker = await getWorker(this.model.uri);
        const diagnostics = await worker.getSemanticDiagnostics(this.model.uri.toString());
        const names: string[] = diagnostics
            .filter((d: { code: number }) => d.code === 2304 || d.code === 2552)
            .map((d: { start: number; length: number }) =>
                this.model.getValue().substr(d.start, d.length),
            );
        const code = this.model.getValue();
        const fixed = missingCoreImports(code, coreExportNames(coreTypes), names);
        if (fixed !== code) this.model.setValue(fixed);
    }

    private fail(title: string, error: unknown): void {
        const detail =
            typeof error === 'string' ? error : error instanceof Error ? error.message : String(error);
        this.status = { kind: 'error', title, detail };
        this.cdr.markForCheck();
    }

    private message(text: string | { messageText: string }): string {
        return typeof text === 'string' ? text : text.messageText;
    }

    private example(id: string | undefined): PlaygroundExample | undefined {
        return PLAYGROUND_EXAMPLES.find((e) => e.id === id);
    }

    private saveDraft(): void {
        if (!this.model || this.fromLink) return;
        try {
            localStorage.setItem(
                DRAFT_KEY,
                JSON.stringify({ exampleId: this.exampleId, code: this.model.getValue(), commands: this.commands }),
            );
        } catch {
            // Private mode or storage disabled: the draft is not kept
        }
    }

    private readDraft(): { exampleId?: string; code?: string; commands?: string } | undefined {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            return raw ? JSON.parse(raw) : undefined;
        } catch {
            return undefined;
        }
    }
}

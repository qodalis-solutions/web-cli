import {
    Directive,
    ElementRef,
    AfterViewInit,
    OnDestroy,
    Renderer2,
} from '@angular/core';

import * as Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sass';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-csharp';

const LABEL_LANG_MAP: Record<string, string> = {
    'app.module.ts': 'typescript',
    'app.component.ts': 'typescript',
    'app.component.html': 'markup',
    'app.tsx': 'typescript',
    'app.vue': 'markup',
    'server.ts': 'typescript',
    'server.py': 'python',
    'program.cs': 'csharp',
    'processors.ts': 'typescript',
    'processors.py': 'python',
    'greet-processor.ts': 'typescript',
    'nested-processor.ts': 'typescript',
    'extend-processor.ts': 'typescript',
    'writer-examples.ts': 'typescript',
    'spinner-example.ts': 'typescript',
    'fullscreen-example.ts': 'typescript',
    'abort-example.ts': 'typescript',
    'custom-theme.css': 'css',
    'my-theme.sass': 'sass',
    'cli-weather-command-processor.ts': 'typescript',
    'lang-pack-example.ts': 'typescript',
    'readline': 'typescript',
    'readpassword': 'typescript',
    'readconfirm': 'typescript',
    'readselect': 'typescript',
    'readmultiselect': 'typescript',
    'readnumber': 'typescript',
    'angular.json': 'json',
    'shell': 'bash',
    'npm': 'bash',
    'pip': 'bash',
    'nuget': 'bash',
    'terminal': 'bash',
    'setup': 'typescript',
    'template': 'markup',
    'import and use': 'typescript',
    'generated files': 'bash',
    'architecture': 'bash',
    'angular': 'markup',
    'react': 'markup',
    'vue': 'markup',
};

@Directive({
    selector: '.code-block',
})
export class CopyCodeDirective implements AfterViewInit, OnDestroy {
    private btn!: HTMLButtonElement;
    private listener?: () => void;
    private timeout?: ReturnType<typeof setTimeout>;

    constructor(
        private el: ElementRef<HTMLElement>,
        private renderer: Renderer2,
    ) {}

    ngAfterViewInit(): void {
        const host = this.el.nativeElement;
        this.renderer.setStyle(host, 'position', 'relative');

        // Copy button
        this.btn = this.renderer.createElement('button');
        this.renderer.addClass(this.btn, 'code-copy-btn');
        this.btn.textContent = 'Copy';
        this.renderer.appendChild(host, this.btn);

        this.listener = this.renderer.listen(this.btn, 'click', () =>
            this.copy(),
        );

        // Syntax highlighting
        this.highlight();
    }

    ngOnDestroy(): void {
        if (this.listener) this.listener();
        if (this.timeout) clearTimeout(this.timeout);
    }

    private copy(): void {
        const code =
            this.el.nativeElement.querySelector('code')?.textContent ?? '';
        navigator.clipboard.writeText(code).then(() => {
            this.btn.textContent = 'Copied!';
            this.btn.classList.add('copied');
            this.timeout = setTimeout(() => {
                this.btn.textContent = 'Copy';
                this.btn.classList.remove('copied');
            }, 2000);
        });
    }

    private highlight(): void {
        const codeEl = this.el.nativeElement.querySelector('code');
        if (!codeEl) return;

        const lang = this.detectLanguage();
        if (lang) {
            codeEl.classList.add(`language-${lang}`);
            Prism.highlightElement(codeEl);
        }
    }

    private detectLanguage(): string {
        const labelEl = this.el.nativeElement.querySelector('.code-label');
        if (labelEl) {
            const label = labelEl.textContent?.trim().toLowerCase() ?? '';
            if (LABEL_LANG_MAP[label]) {
                return LABEL_LANG_MAP[label];
            }
            // Fallback heuristics from label
            if (label.endsWith('.ts')) return 'typescript';
            if (label.endsWith('.js')) return 'javascript';
            if (label.endsWith('.py')) return 'python';
            if (label.endsWith('.cs')) return 'csharp';
            if (label.endsWith('.css')) return 'css';
            if (label.endsWith('.sass') || label.endsWith('.scss'))
                return 'sass';
            if (label.endsWith('.html')) return 'markup';
            if (label.endsWith('.json')) return 'json';
        }

        // Content-based detection
        const text = this.el.nativeElement.querySelector('code')?.textContent ?? '';
        if (
            text.includes('import {') ||
            text.includes('export class') ||
            text.includes('const ') ||
            text.includes(': Promise<') ||
            text.includes('async ')
        ) {
            return 'typescript';
        }
        if (text.includes('npm install') || text.includes('npx ') || text.includes('docker ')) {
            return 'bash';
        }
        if (text.includes('<cli') || text.includes('<Cli') || text.includes('<template>')) {
            return 'markup';
        }
        if (text.includes('from qodalis') || text.includes('def ') || text.includes('pip install')) {
            return 'python';
        }
        if (text.includes('dotnet ') || text.includes('builder.Services') || text.includes('AddCli')) {
            return 'csharp';
        }

        return 'typescript';
    }
}

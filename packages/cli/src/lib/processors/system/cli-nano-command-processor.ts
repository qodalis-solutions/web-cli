import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    DefaultLibraryAuthor,
} from '@qodalis/cli-core';
import { NanoEditorBuffer } from '../../editor/nano-editor-buffer';
import { NanoEditorRenderer } from '../../editor/nano-editor-renderer';
import { SyntaxHighlightEngine } from '../../editor/syntax/engine';
import { SyntaxHighlighterRegistry } from '../../editor/syntax/registry';
import { defaultSyntaxTheme } from '../../editor/syntax/theme';
import { getAccelerator } from '../../wasm';

/** Token string for IFileSystemService — avoid hard dependency on files plugin. */
const FS_TOKEN = 'cli-file-system-service';

/** Minimal interface for file operations (matches IFileSystemService). */
interface FileSystemLike {
    readFile(path: string): string | null;
    writeFile(path: string, content: string, append?: boolean): void;
    createFile(path: string, content?: string): void;
    exists(path: string): boolean;
    isDirectory(path: string): boolean;
    resolvePath(path: string): string;
    persist(): Promise<void>;
}

/** Tracks which interactive prompt is active. */
type InputMode =
    | 'normal'
    | 'help'
    | 'filename'
    | 'search'
    | 'replace-needle'
    | 'replace-with'
    | 'replace-confirm'
    | 'exit-save-prompt'
    | 'read-file';

export class CliNanoCommandProcessor implements ICliCommandProcessor {
    command = 'nano';
    aliases = ['edit'];
    description = 'Open the built-in text editor';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    metadata: CliProcessorMetadata = {
        icon: '📝',
        module: 'system',
    };

    private buffer!: NanoEditorBuffer;
    private renderer!: NanoEditorRenderer;
    private filePath: string | null = null;
    private fs: FileSystemLike | null = null;
    private context!: ICliExecutionContext;
    private resizeDisposable: { dispose(): void } | null = null;
    private statusMessage: string | undefined;
    private statusTimeout: ReturnType<typeof setTimeout> | null = null;

    private inputMode: InputMode = 'normal';
    private inputBuffer = '';
    private searchNeedle = '';
    private replaceWith = '';
    private replaceAllMode = false;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        this.context = context;
        this.buffer = new NanoEditorBuffer();
        this.renderer = new NanoEditorRenderer(context.terminal);
        this.inputMode = 'normal';
        this.inputBuffer = '';
        this.searchNeedle = '';
        this.replaceWith = '';
        this.statusMessage = undefined;

        // Try to get filesystem service (optional)
        try {
            this.fs = context.services.get<FileSystemLike>(FS_TOKEN);
        } catch {
            this.fs = null;
        }

        // Parse file path from command
        const args = (command.value || '').trim();
        if (args) {
            this.filePath = args;

            if (this.fs) {
                try {
                    const resolved = this.fs.resolvePath(this.filePath);
                    if (
                        this.fs.exists(resolved) &&
                        !this.fs.isDirectory(resolved)
                    ) {
                        const content = this.fs.readFile(resolved);
                        if (content !== null) {
                            this.buffer.load(content);
                        }
                        this.filePath = resolved;
                    } else if (
                        this.fs.exists(resolved) &&
                        this.fs.isDirectory(resolved)
                    ) {
                        context.writer.writeError(
                            `${this.filePath} is a directory`,
                        );
                        return;
                    } else {
                        this.filePath = resolved;
                        // New file — empty buffer is fine
                    }
                } catch (e: any) {
                    context.writer.writeError(
                        e.message || 'Error opening file',
                    );
                    return;
                }
            }
        } else {
            this.filePath = null;
        }

        // Set up syntax highlighting
        this.setupHighlighting(this.filePath);

        // Enter full-screen editor mode
        context.enterFullScreenMode(this);
        this.renderer.render(this.buffer, this.filePath || 'New Buffer');

        // Handle terminal resize
        this.resizeDisposable = context.terminal.onResize(() => {
            if (this.inputMode === 'help') {
                this.renderer.renderHelp();
            } else {
                this.renderer.render(
                    this.buffer,
                    this.filePath || 'New Buffer',
                    this.statusMessage,
                );
            }
        });
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        switch (this.inputMode) {
            case 'help':
                // Any key returns to editor
                this.inputMode = 'normal';
                this.render();
                return;

            case 'filename':
                this.handleTextPrompt(data, (name) => {
                    if (name) {
                        this.filePath = this.fs!.resolvePath(name);
                        this.save();
                    } else {
                        this.showStatus('Cancelled');
                    }
                });
                return;

            case 'search':
                this.handleTextPrompt(data, (query) => {
                    if (query) {
                        this.searchNeedle = query;
                        if (this.buffer.searchForward(this.searchNeedle)) {
                            this.render();
                        } else {
                            this.showStatus(`"${this.searchNeedle}" not found`);
                        }
                    } else {
                        this.showStatus('Cancelled');
                    }
                });
                return;

            case 'replace-needle':
                this.handleTextPrompt(data, (needle) => {
                    if (needle) {
                        this.searchNeedle = needle;
                        this.inputMode = 'replace-with';
                        this.inputBuffer = this.replaceWith;
                        this.renderPrompt(`Replace with: ${this.inputBuffer}`);
                    } else {
                        this.showStatus('Cancelled');
                    }
                });
                return;

            case 'replace-with':
                this.handleTextPrompt(data, (replacement) => {
                    this.replaceWith = replacement ?? '';
                    if (this.replaceAllMode) {
                        const count = this.buffer.replaceAll(
                            this.searchNeedle,
                            this.replaceWith,
                        );
                        this.showStatus(
                            count > 0
                                ? `Replaced ${count} occurrence${count > 1 ? 's' : ''}`
                                : `"${this.searchNeedle}" not found`,
                        );
                    } else {
                        // Find first match and ask for confirmation
                        if (this.buffer.searchForward(this.searchNeedle)) {
                            this.inputMode = 'replace-confirm';
                            this.render();
                            this.renderPrompt(
                                'Replace this instance? [Y]es/[N]o/[A]ll/[C]ancel',
                            );
                        } else {
                            this.showStatus(`"${this.searchNeedle}" not found`);
                        }
                    }
                });
                return;

            case 'replace-confirm':
                this.handleReplaceConfirm(data);
                return;

            case 'exit-save-prompt':
                this.handleExitSavePrompt(data);
                return;

            case 'read-file':
                this.handleTextPrompt(data, (path) => {
                    if (path) {
                        this.readFileIntoBuffer(path);
                    } else {
                        this.showStatus('Cancelled');
                    }
                });
                return;

            default:
                break;
        }

        // ── Normal mode key handling ──

        // Ctrl+X — Exit
        if (data === '\x18') {
            this.exitEditor();
            return;
        }

        // Ctrl+O — Write Out (save)
        if (data === '\x0F') {
            await this.writeOut();
            return;
        }

        // Ctrl+S — Save (common alternative)
        if (data === '\x13') {
            await this.save();
            return;
        }

        // Ctrl+G — Help
        if (data === '\x07') {
            this.inputMode = 'help';
            this.renderer.renderHelp();
            return;
        }

        // Ctrl+W or Ctrl+F — Where Is (search)
        if (data === '\x17' || data === '\x06') {
            this.inputMode = 'search';
            this.inputBuffer = this.searchNeedle;
            this.renderPrompt(`Search: ${this.inputBuffer}`);
            return;
        }

        // Ctrl+\ — Replace
        if (data === '\x1C') {
            this.replaceAllMode = false;
            this.inputMode = 'replace-needle';
            this.inputBuffer = this.searchNeedle;
            this.renderPrompt(`Search (to replace): ${this.inputBuffer}`);
            return;
        }

        // Ctrl+K — Cut line
        if (data === '\x0B') {
            this.buffer.deleteLine();
            this.renderer.highlightEngine?.invalidate(this.buffer.cursorRow);
            this.render();
            return;
        }

        // Ctrl+U — Uncut (paste)
        if (data === '\x15') {
            if (this.buffer.uncutLines()) {
                this.renderer.highlightEngine?.invalidate(this.buffer.cursorRow);
                this.render();
            } else {
                this.showStatus('Clipboard is empty');
            }
            return;
        }

        // Ctrl+C — Cursor position
        if (data === '\x03') {
            const row = this.buffer.cursorRow + 1;
            const col = this.buffer.cursorCol + 1;
            const total = this.buffer.lines.length;
            this.showStatus(`line ${row}/${total}, col ${col}`);
            return;
        }

        // Ctrl+R — Read File
        if (data === '\x12') {
            if (!this.fs) {
                this.showStatus('No filesystem available');
                return;
            }
            this.inputMode = 'read-file';
            this.inputBuffer = '';
            this.renderPrompt('File to insert: ');
            return;
        }

        // Ctrl+A — Home (beginning of line)
        if (data === '\x01') {
            this.buffer.moveHome();
            this.render();
            return;
        }

        // Ctrl+E — End (end of line)
        if (data === '\x05') {
            this.buffer.moveEnd();
            this.render();
            return;
        }

        // Ctrl+P — Previous line
        if (data === '\x10') {
            this.buffer.moveUp();
            this.render();
            return;
        }

        // Ctrl+N — Next line
        if (data === '\x0E') {
            this.buffer.moveDown();
            this.render();
            return;
        }

        // Ctrl+F is remapped to Search (above) — use arrow keys for cursor movement

        // Ctrl+B — Backward (left)
        if (data === '\x02') {
            this.buffer.moveLeft();
            this.render();
            return;
        }

        // Ctrl+Y — Page Up
        if (data === '\x19') {
            this.buffer.pageUp(this.renderer.contentHeight);
            this.render();
            return;
        }

        // Ctrl+V — Page Down
        if (data === '\x16') {
            this.buffer.pageDown(this.renderer.contentHeight);
            this.render();
            return;
        }

        // Enter
        if (data === '\r') {
            this.buffer.insertNewline();
            this.renderer.highlightEngine?.invalidate(this.buffer.cursorRow - 1);
            this.render();
            return;
        }

        // Backspace
        if (data === '\x7F') {
            const wasMerge = this.buffer.cursorCol === 0 && this.buffer.cursorRow > 0;
            this.buffer.deleteCharBefore();
            if (wasMerge) {
                this.renderer.highlightEngine?.invalidate(this.buffer.cursorRow);
            }
            this.render();
            return;
        }

        // Delete key (escape sequence)
        if (data === '\x1b[3~') {
            this.buffer.deleteCharAt();
            this.render();
            return;
        }

        // Arrow keys
        if (data === '\x1b[A') {
            this.buffer.moveUp();
            this.render();
            return;
        }
        if (data === '\x1b[B') {
            this.buffer.moveDown();
            this.render();
            return;
        }
        if (data === '\x1b[C') {
            this.buffer.moveRight();
            this.render();
            return;
        }
        if (data === '\x1b[D') {
            this.buffer.moveLeft();
            this.render();
            return;
        }

        // Home / End
        if (data === '\x1b[H' || data === '\x1b[1~') {
            this.buffer.moveHome();
            this.render();
            return;
        }
        if (data === '\x1b[F' || data === '\x1b[4~') {
            this.buffer.moveEnd();
            this.render();
            return;
        }

        // Page Up / Page Down
        if (data === '\x1b[5~') {
            this.buffer.pageUp(this.renderer.contentHeight);
            this.render();
            return;
        }
        if (data === '\x1b[6~') {
            this.buffer.pageDown(this.renderer.contentHeight);
            this.render();
            return;
        }

        // Ignore other escape sequences
        if (data.startsWith('\x1b')) {
            return;
        }

        // Ignore other control characters
        if (data.length === 1 && data.charCodeAt(0) < 32) {
            return;
        }

        // Printable text — insert
        this.buffer.insertChar(data);
        this.render();
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.nano.long_description', 'Open the built-in nano-style text editor'));
        writer.writeln();
        writer.writeln(t.t('cli.common.usage', 'Usage:'));
        writer.writeln(
            `  ${writer.wrapInColor('nano', CliForegroundColor.Cyan)}                    ${t.t('cli.nano.open_empty', 'Open empty scratch buffer')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('nano <file>', CliForegroundColor.Cyan)}              ${t.t('cli.nano.open_file', 'Open or create a file')}`,
        );
        writer.writeln();
        writer.writeln(t.t('cli.nano.keyboard_shortcuts', 'Keyboard shortcuts:'));
        writer.writeln(
            `  ${writer.wrapInColor('^X', CliForegroundColor.Yellow)}  Exit              ${writer.wrapInColor('^O', CliForegroundColor.Yellow)}  Write Out (save)`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('^G', CliForegroundColor.Yellow)}  Help              ${writer.wrapInColor('^F', CliForegroundColor.Yellow)}  Search`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('^K', CliForegroundColor.Yellow)}  Cut line          ${writer.wrapInColor('^U', CliForegroundColor.Yellow)}  Paste line`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('^\\', CliForegroundColor.Yellow)}  Replace           ${writer.wrapInColor('^R', CliForegroundColor.Yellow)}  Read File`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('^C', CliForegroundColor.Yellow)}  Cursor position   ${writer.wrapInColor('^S', CliForegroundColor.Yellow)}  Save (quick)`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('^A', CliForegroundColor.Yellow)}  Home              ${writer.wrapInColor('^E', CliForegroundColor.Yellow)}  End`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('^Y', CliForegroundColor.Yellow)}  Page Up           ${writer.wrapInColor('^V', CliForegroundColor.Yellow)}  Page Down`,
        );
    }

    // ── Syntax highlighting ──

    private setupHighlighting(filePath: string | null): void {
        if (!filePath) {
            this.renderer.highlightEngine = undefined;
            return;
        }
        try {
            const registry = this.context.services.get<SyntaxHighlighterRegistry>(
                'syntax-highlighter-registry'
            );
            const ext = '.' + filePath.split('.').pop()?.toLowerCase();
            const highlighter = registry.getByExtension(ext);
            if (highlighter) {
                this.renderer.highlightEngine = new SyntaxHighlightEngine(
                    highlighter,
                    defaultSyntaxTheme,
                    getAccelerator(),
                );
            } else {
                this.renderer.highlightEngine = undefined;
            }
        } catch {
            this.renderer.highlightEngine = undefined;
        }
    }

    // ── Rendering helpers ──

    private render(): void {
        this.renderer.render(
            this.buffer,
            this.filePath || 'New Buffer',
            this.statusMessage,
        );
    }

    private renderPrompt(prompt: string): void {
        this.renderer.renderStatusOnly(this.buffer, `  ${prompt}`);
    }

    private showStatus(message: string, duration = 2000): void {
        this.statusMessage = `  ${message}`;
        this.renderer.renderStatusOnly(this.buffer, this.statusMessage);

        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }
        this.statusTimeout = setTimeout(() => {
            this.statusMessage = undefined;
            this.render();
        }, duration);
    }

    // ── Generic text prompt handler ──

    private handleTextPrompt(
        data: string,
        onConfirm: (value: string | null) => void,
    ): void {
        if (data === '\r') {
            // Enter — confirm
            this.inputMode = 'normal';
            onConfirm(this.inputBuffer.trim() || null);
            return;
        }

        if (data === '\x1b' || data === '\x03') {
            // Escape or Ctrl+C — cancel
            this.inputMode = 'normal';
            onConfirm(null);
            return;
        }

        if (data === '\x7F') {
            // Backspace
            if (this.inputBuffer.length > 0) {
                this.inputBuffer = this.inputBuffer.slice(0, -1);
            }
        } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
            // Printable character
            this.inputBuffer += data;
        } else {
            return;
        }

        // Re-render the current prompt with updated input
        const label = this.getPromptLabel();
        this.renderPrompt(`${label}${this.inputBuffer}`);
    }

    private getPromptLabel(): string {
        switch (this.inputMode) {
            case 'filename':
                return 'File Name to Write: ';
            case 'search':
                return 'Search: ';
            case 'replace-needle':
                return 'Search (to replace): ';
            case 'replace-with':
                return 'Replace with: ';
            case 'read-file':
                return 'File to insert: ';
            default:
                return '';
        }
    }

    // ── Replace confirmation handler ──

    private handleReplaceConfirm(data: string): void {
        const key = data.toLowerCase();

        if (key === 'y') {
            this.buffer.replaceNext(this.searchNeedle, this.replaceWith);
            // Search for next occurrence
            if (this.buffer.searchForward(this.searchNeedle)) {
                this.render();
                this.renderPrompt(
                    'Replace this instance? [Y]es/[N]o/[A]ll/[C]ancel',
                );
            } else {
                this.inputMode = 'normal';
                this.showStatus('No more occurrences');
            }
        } else if (key === 'n') {
            // Skip this occurrence, search for next
            if (this.buffer.searchForward(this.searchNeedle)) {
                this.render();
                this.renderPrompt(
                    'Replace this instance? [Y]es/[N]o/[A]ll/[C]ancel',
                );
            } else {
                this.inputMode = 'normal';
                this.showStatus('No more occurrences');
            }
        } else if (key === 'a') {
            // Replace all remaining
            const count = this.buffer.replaceAll(
                this.searchNeedle,
                this.replaceWith,
            );
            this.inputMode = 'normal';
            this.showStatus(
                `Replaced ${count} occurrence${count !== 1 ? 's' : ''}`,
            );
        } else if (key === 'c' || data === '\x1b' || data === '\x03') {
            // Cancel
            this.inputMode = 'normal';
            this.showStatus('Cancelled');
        }
    }

    // ── Exit handler (^X) — matches real nano behavior ──

    private exitEditor(): void {
        if (!this.buffer.dirty) {
            this.cleanup();
            return;
        }

        // Prompt: "Save modified buffer?"
        this.inputMode = 'exit-save-prompt';
        this.renderPrompt('Save modified buffer? [Y]es/[N]o/[C]ancel');
    }

    private handleExitSavePrompt(data: string): void {
        const key = data.toLowerCase();

        if (key === 'y') {
            this.inputMode = 'normal';
            // Save then exit
            this.save().then(() => {
                this.cleanup();
            });
        } else if (key === 'n') {
            // Discard and exit
            this.inputMode = 'normal';
            this.cleanup();
        } else if (key === 'c' || data === '\x1b' || data === '\x03') {
            // Cancel — return to editor
            this.inputMode = 'normal';
            this.render();
        }
    }

    // ── Write Out (^O) — save with filename prompt ──

    private async writeOut(): Promise<void> {
        if (!this.fs) {
            this.showStatus(
                'No filesystem available — install @qodalis/cli-files',
            );
            return;
        }

        if (!this.filePath) {
            this.inputMode = 'filename';
            this.inputBuffer = '';
            this.renderPrompt('File Name to Write: ');
            return;
        }

        // Show filename in prompt, allow editing
        this.inputMode = 'filename';
        this.inputBuffer = this.filePath;
        this.renderPrompt(`File Name to Write: ${this.inputBuffer}`);
    }

    // ── Save (direct, no prompt if path is known) ──

    private async save(): Promise<void> {
        if (!this.fs) {
            this.showStatus(
                'No filesystem available — install @qodalis/cli-files',
            );
            return;
        }

        if (!this.filePath) {
            this.inputMode = 'filename';
            this.inputBuffer = '';
            this.renderPrompt('File Name to Write: ');
            return;
        }

        try {
            const content = this.buffer.getContent();
            if (this.fs.exists(this.filePath)) {
                this.fs.writeFile(this.filePath, content);
            } else {
                this.fs.createFile(this.filePath, content);
            }
            await this.fs.persist();
            this.buffer.dirty = false;
            this.showStatus(
                `Wrote ${this.buffer.lines.length} lines to ${this.filePath}`,
            );
        } catch (e: any) {
            this.showStatus(`Error: ${e.message}`);
        }
    }

    // ── Read File (^R) — insert file contents at cursor ──

    private readFileIntoBuffer(path: string): void {
        if (!this.fs) {
            this.showStatus('No filesystem available');
            return;
        }

        try {
            const resolved = this.fs.resolvePath(path);
            if (!this.fs.exists(resolved)) {
                this.showStatus(`File not found: ${path}`);
                return;
            }
            if (this.fs.isDirectory(resolved)) {
                this.showStatus(`${path} is a directory`);
                return;
            }
            const content = this.fs.readFile(resolved);
            if (content === null) {
                this.showStatus(`Could not read: ${path}`);
                return;
            }

            const lines = content.split('\n');
            // Insert lines at current cursor row
            this.buffer.lines.splice(this.buffer.cursorRow + 1, 0, ...lines);
            this.buffer.dirty = true;
            this.showStatus(`Read ${lines.length} lines from ${path}`);
        } catch (e: any) {
            this.showStatus(`Error: ${e.message}`);
        }
    }

    // ── Cleanup ──

    private cleanup(): void {
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }
        this.resizeDisposable?.dispose();
        this.context.exitFullScreenMode();
    }
}

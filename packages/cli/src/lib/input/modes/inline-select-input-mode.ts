import { CliSelectOption, CliSelectOptions } from '@qodalis/cli-core';
import { InputModeHost } from '../input-mode';
import { InputModeBase } from './input-mode-base';

/**
 * Input mode for selecting a single option from a horizontal inline list.
 *
 * Features:
 * - Left/Right arrow navigation with wrap-around
 * - Disabled option skipping
 * - Default value sets initial selection
 * - onChange callback on navigation
 * - Overflow handling with scroll indicators (◂/▸) when options exceed terminal width
 * - Responsive: recalculates visible window on terminal resize
 *
 * Renders all options on a single line:
 * `? Prompt:  Option1  [ Selected ]  Option3`
 */
export class InlineSelectInputMode extends InputModeBase<string> {
    /** Index into the selectable (non-disabled) options */
    private selectedIndex = 0;
    /** Start index of the visible window (into selectable options) */
    private visibleStart = 0;
    /** End index (exclusive) of the visible window */
    private visibleEnd = 0;
    /** Cached list of selectable (non-disabled) options */
    private selectableOptions: CliSelectOption[];

    constructor(
        host: InputModeHost,
        resolve: (value: string | null) => void,
        private readonly promptText: string,
        private readonly options: CliSelectOption[],
        private readonly selectOptions?: CliSelectOptions,
    ) {
        super(host, resolve);
        this.selectableOptions = options.filter(o => !o.disabled);
    }

    activate(): void {
        // Set default selection if specified
        if (this.selectOptions?.default) {
            const idx = this.selectableOptions.findIndex(
                o => o.value === this.selectOptions!.default,
            );
            if (idx >= 0) {
                this.selectedIndex = idx;
            }
        }

        this.calculateVisibleWindow();
        this.render();
    }

    /**
     * Clear the inline options and help bar, then show final answer before resolving.
     */
    override resolveAndPop(value: string): void {
        this.clearExtraLines();
        // Redraw prompt line with just the answered value
        const selectedOpt = this.selectableOptions.find(o => o.value === value);
        const label = selectedOpt ? selectedOpt.label : value;
        this.host.terminal.write('\x1b[2K\r');
        this.host.terminal.write(`\x1b[32m\u2714\x1b[0m ${this.promptText}: \x1b[36m${label}\x1b[0m`);
        super.resolveAndPop(value);
    }

    /**
     * Clear the inline options and help bar before aborting.
     */
    protected override abort(): void {
        this.clearExtraLines();
        this.host.terminal.write('\x1b[2K\r');
        this.host.terminal.write(`\x1b[33m\u2718\x1b[0m ${this.promptText}: \x1b[2mcancelled\x1b[0m`);
        super.abort();
    }

    async handleInput(data: string): Promise<void> {
        if (data === '\x1b[C') {
            // Right arrow
            this.moveSelection(1);
        } else if (data === '\x1b[D') {
            // Left arrow
            this.moveSelection(-1);
        } else if (data === '\r') {
            // Enter — resolve with selected value
            if (this.selectableOptions.length > 0) {
                this.resolveAndPop(this.selectableOptions[this.selectedIndex].value);
            }
        }
        // Ignore all other input
    }

    onResize(cols: number, rows: number): void {
        this.calculateVisibleWindow();
        this.render();
    }

    // ── Private helpers ──────────────────────────────────────────────

    /**
     * Move selection in the given direction, skipping disabled options.
     * Wraps around at boundaries.
     */
    private moveSelection(direction: 1 | -1): void {
        if (this.selectableOptions.length === 0) return;

        let next = this.selectedIndex + direction;
        if (next < 0) next = this.selectableOptions.length - 1;
        if (next >= this.selectableOptions.length) next = 0;

        this.selectedIndex = next;

        // Ensure selected is within the visible window
        this.adjustVisibleWindow();

        // Fire onChange
        if (this.selectOptions?.onChange) {
            this.selectOptions.onChange(this.selectableOptions[this.selectedIndex].value);
        }

        this.render();
    }

    /**
     * Get the prompt prefix string (without ANSI escapes for width calculation).
     */
    private getPromptPrefix(): string {
        return `? ${this.promptText}: `;
    }

    /**
     * Get the rendered prompt prefix (with ANSI color codes).
     */
    private getRenderedPromptPrefix(): string {
        return `\x1b[36m?\x1b[0m ${this.promptText}: `;
    }

    /**
     * Calculate the width needed for a single option.
     * Selected option: `[ label ]` (label.length + 4)
     * Unselected option: ` label ` (label.length + 2)
     */
    private getOptionWidth(opt: CliSelectOption, isSelected: boolean): number {
        return isSelected ? opt.label.length + 4 : opt.label.length + 2;
    }

    /**
     * Calculate how many options fit in the visible window starting from a given index.
     */
    private calculateVisibleWindow(): void {
        const cols = this.host.getTerminalCols();
        const promptWidth = this.getPromptPrefix().length;
        const available = cols - promptWidth;

        if (this.selectableOptions.length === 0) {
            this.visibleStart = 0;
            this.visibleEnd = 0;
            return;
        }

        // Check if all options fit
        let totalWidth = 0;
        for (let i = 0; i < this.selectableOptions.length; i++) {
            totalWidth += this.getOptionWidth(this.selectableOptions[i], i === this.selectedIndex);
        }

        if (totalWidth <= available) {
            this.visibleStart = 0;
            this.visibleEnd = this.selectableOptions.length;
            return;
        }

        // Not all options fit — calculate a window around the selected index
        this.adjustVisibleWindow();
    }

    /**
     * Adjust the visible window so the selected option is visible.
     * Accounts for scroll indicator widths.
     */
    private adjustVisibleWindow(): void {
        const cols = this.host.getTerminalCols();
        const promptWidth = this.getPromptPrefix().length;
        const available = cols - promptWidth;

        if (this.selectableOptions.length === 0) return;

        // Check if all fit
        let totalWidth = 0;
        for (let i = 0; i < this.selectableOptions.length; i++) {
            totalWidth += this.getOptionWidth(this.selectableOptions[i], i === this.selectedIndex);
        }
        if (totalWidth <= available) {
            this.visibleStart = 0;
            this.visibleEnd = this.selectableOptions.length;
            return;
        }

        // Indicator width: `◂ ` or ` ▸` = 2 chars each
        const indicatorWidth = 2;

        // If selected is before visible start, shift window left
        if (this.selectedIndex < this.visibleStart) {
            this.visibleStart = this.selectedIndex;
        }

        // Calculate from visibleStart, expanding end
        let usedWidth = 0;
        const hasLeftIndicator = this.visibleStart > 0;
        if (hasLeftIndicator) {
            usedWidth += indicatorWidth;
        }

        let end = this.visibleStart;
        for (let i = this.visibleStart; i < this.selectableOptions.length; i++) {
            const optWidth = this.getOptionWidth(this.selectableOptions[i], i === this.selectedIndex);
            const needsRightIndicator = i < this.selectableOptions.length - 1;
            const rightReserve = needsRightIndicator ? indicatorWidth : 0;

            if (usedWidth + optWidth + rightReserve <= available) {
                usedWidth += optWidth;
                end = i + 1;
            } else {
                break;
            }
        }

        // If selected is beyond the end, shift window right
        if (this.selectedIndex >= end) {
            // Recalculate from the selected index backwards
            end = this.selectedIndex + 1;
            usedWidth = this.getOptionWidth(
                this.selectableOptions[this.selectedIndex],
                true,
            );
            const hasRightIndicator = end < this.selectableOptions.length;
            if (hasRightIndicator) {
                usedWidth += indicatorWidth;
            }

            let start = this.selectedIndex;
            for (let i = this.selectedIndex - 1; i >= 0; i--) {
                const optWidth = this.getOptionWidth(this.selectableOptions[i], false);
                const needsLeftIndicator = i > 0;
                const leftReserve = needsLeftIndicator ? indicatorWidth : 0;
                const currentLeftReserve = start > 0 ? indicatorWidth : 0;

                if (usedWidth - currentLeftReserve + optWidth + leftReserve <= available) {
                    usedWidth = usedWidth - currentLeftReserve + optWidth + leftReserve;
                    start = i;
                } else {
                    break;
                }
            }

            this.visibleStart = start;
            end = this.selectedIndex + 1;

            // Re-expand end if there's room
            usedWidth = 0;
            if (this.visibleStart > 0) usedWidth += indicatorWidth;
            for (let i = this.visibleStart; i < end; i++) {
                usedWidth += this.getOptionWidth(this.selectableOptions[i], i === this.selectedIndex);
            }
            for (let i = end; i < this.selectableOptions.length; i++) {
                const optWidth = this.getOptionWidth(this.selectableOptions[i], false);
                const needsRightIndicator = i < this.selectableOptions.length - 1;
                const rightReserve = needsRightIndicator ? indicatorWidth : 0;
                if (usedWidth + optWidth + rightReserve <= available) {
                    usedWidth += optWidth;
                    end = i + 1;
                } else {
                    break;
                }
            }
        }

        this.visibleEnd = end;
    }

    /**
     * Render the complete inline select display.
     */
    private render(): void {
        this.clearExtraLines();
        this.host.terminal.write('\x1b[2K\r');

        // Prompt prefix
        this.host.terminal.write(this.getRenderedPromptPrefix());

        if (this.selectableOptions.length === 0) return;

        const hasLeftOverflow = this.visibleStart > 0;
        const hasRightOverflow = this.visibleEnd < this.selectableOptions.length;

        // Left overflow indicator
        if (hasLeftOverflow) {
            this.host.terminal.write('\x1b[2m\u25C2\x1b[0m ');
        }

        // Render visible options
        for (let i = this.visibleStart; i < this.visibleEnd; i++) {
            const opt = this.selectableOptions[i];
            const isSelected = i === this.selectedIndex;

            if (isSelected) {
                this.host.terminal.write(`\x1b[36m[ ${opt.label} ]\x1b[0m`);
            } else {
                this.host.terminal.write(` ${opt.label} `);
            }
        }

        // Right overflow indicator
        if (hasRightOverflow) {
            this.host.terminal.write(' \x1b[2m\u25B8\x1b[0m');
        }

        // Help bar
        this.writeHelp('\u2190/\u2192 navigate \u00B7 enter to select \u00B7 esc to cancel');
    }
}

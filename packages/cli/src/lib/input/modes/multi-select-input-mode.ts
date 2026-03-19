import { CliMultiSelectOption, CliMultiSelectOptions } from '@qodalis/cli-core';
import { InputModeHost } from '../input-mode';
import { InputModeBase } from './input-mode-base';

/**
 * Represents an item in the flattened display list.
 * Can be either a selectable option or a non-selectable group header.
 */
interface DisplayItem {
    type: 'option' | 'group-header';
    option?: CliMultiSelectOption;
    groupName?: string;
}

/**
 * Input mode for selecting multiple options from a checkbox list.
 *
 * Features:
 * - Arrow key navigation with wrap-around
 * - Space to toggle checked state
 * - 'a' to select all / deselect all non-disabled options
 * - Disabled option skipping
 * - Group headers (non-selectable dividers)
 * - Optional type-to-filter search with highlighted matches
 * - Scroll support for long lists
 * - Description display (dim italic)
 * - onChange callback on toggle
 * - Modern checkboxes: ◉ (green) for checked, ○ (dim) for unchecked
 */
export class MultiSelectInputMode extends InputModeBase<string[]> {
    private selectedIndex = 0;
    private scrollOffset = 0;
    private maxVisible: number;
    private filter = '';
    private filteredOptions: CliMultiSelectOption[];
    /** Tracks checked state by option value */
    private checkedState: Map<string, boolean>;
    /** Number of lines rendered for the option list + help bar (for clearing) */
    private renderedLines = 0;

    constructor(
        host: InputModeHost,
        resolve: (value: string[] | null) => void,
        private readonly promptText: string,
        private readonly options: CliMultiSelectOption[],
        private readonly selectOptions?: CliMultiSelectOptions,
    ) {
        super(host, resolve);
        this.filteredOptions = [...options];
        this.maxVisible = Math.min(options.length, host.getTerminalRows() - 4);

        // Initialize checked state from options
        this.checkedState = new Map();
        for (const opt of options) {
            this.checkedState.set(opt.value, opt.checked === true);
        }
    }

    activate(): void {
        // Hide cursor during selection
        this.host.terminal.write('\x1b[?25l');

        // Start on first non-disabled option
        this.selectedIndex = 0;
        const selectables = this.filteredOptions.filter(o => !o.disabled);
        if (selectables.length > 0) {
            this.selectedIndex = 0;
        }

        this.renderAll();
    }

    /**
     * Handle keyboard events. When searchable and filter is non-empty,
     * Escape clears the filter instead of aborting.
     */
    override handleKeyEvent(event: KeyboardEvent): boolean {
        if (this.selectOptions?.searchable && this.filter.length > 0) {
            if (event.code === 'Escape') {
                this.clearFilter();
                return false;
            }
        }
        return super.handleKeyEvent(event);
    }

    /**
     * Clear rendered option lines and show final answer before resolving.
     */
    override resolveAndPop(value: string[]): void {
        this.clearRenderedLines();
        const labels = value.map(v => {
            const opt = this.options.find(o => o.value === v);
            return opt ? opt.label : v;
        });
        const summary = labels.length > 0 ? labels.join(', ') : 'none';
        this.host.terminal.write('\x1b[2K\r');
        this.host.terminal.write(`\x1b[32m\u2714\x1b[0m ${this.promptText} \x1b[36m${summary}\x1b[0m`);
        this.host.terminal.write('\x1b[?25h'); // Show cursor
        super.resolveAndPop(value);
    }

    /**
     * Clear rendered option lines before aborting.
     */
    protected override abort(): void {
        this.clearRenderedLines();
        this.host.terminal.write('\x1b[2K\r');
        this.host.terminal.write(`\x1b[33m\u2718\x1b[0m ${this.promptText} \x1b[2mcancelled\x1b[0m`);
        this.host.terminal.write('\x1b[?25h'); // Show cursor
        super.abort();
    }

    async handleInput(data: string): Promise<void> {
        if (data === '\x1b[A') {
            // Up arrow
            this.moveSelection(-1);
        } else if (data === '\x1b[B') {
            // Down arrow
            this.moveSelection(1);
        } else if (data === ' ') {
            // Space — toggle checked state
            this.toggleCurrent();
        } else if (data === 'a' && (!this.selectOptions?.searchable || this.filter.length === 0)) {
            // 'a' — select all / deselect all (when not searchable, or searchable with no active filter)
            this.toggleAll();
        } else if (data === '\r') {
            // Enter — resolve with checked values
            this.resolveAndPop(this.getCheckedValues());
        } else if (data === '\u007F') {
            // Backspace
            if (this.selectOptions?.searchable && this.filter.length > 0) {
                this.filter = this.filter.slice(0, -1);
                this.applyFilter();
                this.renderAll();
            }
        } else if (data.startsWith('\x1b')) {
            // Ignore other escape sequences
        } else if (this.selectOptions?.searchable && data.length === 1 && data >= ' ') {
            // Printable character — add to filter
            this.filter += data;
            this.applyFilter();
            this.renderAll();
        }
    }

    onResize(cols: number, rows: number): void {
        this.maxVisible = Math.min(this.filteredOptions.length, rows - 4);
        if (this.scrollOffset + this.maxVisible > this.getSelectableCount()) {
            this.scrollOffset = Math.max(0, this.getSelectableCount() - this.maxVisible);
        }
        this.renderAll();
    }

    // ── Private helpers ──────────────────────────────────────────────

    /**
     * Build flattened display list with group headers inserted.
     */
    private buildDisplayList(): DisplayItem[] {
        const items: DisplayItem[] = [];
        let lastGroup: string | undefined;

        for (const opt of this.filteredOptions) {
            if (opt.group && opt.group !== lastGroup) {
                items.push({ type: 'group-header', groupName: opt.group });
                lastGroup = opt.group;
            }
            items.push({ type: 'option', option: opt });
        }
        return items;
    }

    /**
     * Get the total count of selectable items (non-disabled options).
     */
    private getSelectableCount(): number {
        return this.filteredOptions.filter(o => !o.disabled).length;
    }

    /**
     * Get an array of currently checked values (preserving original order).
     */
    private getCheckedValues(): string[] {
        const result: string[] = [];
        for (const opt of this.options) {
            if (this.checkedState.get(opt.value) === true) {
                result.push(opt.value);
            }
        }
        return result;
    }

    /**
     * Move selection in the given direction (+1 or -1), skipping disabled options.
     * Wraps around at boundaries.
     */
    private moveSelection(direction: 1 | -1): void {
        const selectableCount = this.getSelectableCount();
        if (selectableCount === 0) return;

        let next = this.selectedIndex + direction;

        // Wrap
        if (next < 0) next = selectableCount - 1;
        if (next >= selectableCount) next = 0;

        this.selectedIndex = next;

        // Adjust scroll
        if (this.selectedIndex < this.scrollOffset) {
            this.scrollOffset = this.selectedIndex;
        } else if (this.selectedIndex >= this.scrollOffset + this.maxVisible) {
            this.scrollOffset = this.selectedIndex - this.maxVisible + 1;
        }

        this.renderAll();
    }

    /**
     * Toggle the checked state of the currently selected option.
     */
    private toggleCurrent(): void {
        const selectables = this.filteredOptions.filter(o => !o.disabled);
        if (selectables.length === 0 || this.selectedIndex >= selectables.length) return;

        const opt = selectables[this.selectedIndex];
        const current = this.checkedState.get(opt.value) === true;
        this.checkedState.set(opt.value, !current);

        // Fire onChange
        if (this.selectOptions?.onChange) {
            this.selectOptions.onChange(this.getCheckedValues());
        }

        this.renderAll();
    }

    /**
     * Toggle all non-disabled options: if all are checked, uncheck all; otherwise check all.
     */
    private toggleAll(): void {
        const nonDisabled = this.options.filter(o => !o.disabled);
        const allChecked = nonDisabled.every(o => this.checkedState.get(o.value) === true);

        for (const opt of nonDisabled) {
            this.checkedState.set(opt.value, !allChecked);
        }

        // Fire onChange
        if (this.selectOptions?.onChange) {
            this.selectOptions.onChange(this.getCheckedValues());
        }

        this.renderAll();
    }

    /**
     * Apply the current filter text to the options list.
     */
    private applyFilter(): void {
        if (this.filter.length === 0) {
            this.filteredOptions = [...this.options];
        } else {
            const lower = this.filter.toLowerCase();
            this.filteredOptions = this.options.filter(
                o => o.label.toLowerCase().includes(lower),
            );
        }
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.maxVisible = Math.min(
            this.filteredOptions.length,
            this.host.getTerminalRows() - 4,
        );
    }

    /**
     * Clear the filter and restore full option list.
     */
    private clearFilter(): void {
        this.filter = '';
        this.applyFilter();
        this.renderAll();
    }

    /**
     * Clear all previously rendered lines and re-render everything.
     */
    private renderAll(): void {
        this.clearRenderedLines();
        this.renderPrompt();
        this.renderOptions();
        this.renderHelpBar();

        // Move cursor back up to prompt line
        if (this.renderedLines > 0) {
            this.host.terminal.write(`\x1b[${this.renderedLines}A`);
        }
    }

    /**
     * Clear all lines we previously rendered (below the cursor).
     */
    private clearRenderedLines(): void {
        if (this.renderedLines > 0) {
            this.host.terminal.write('\x1b[s'); // save cursor
            for (let i = 0; i < this.renderedLines; i++) {
                this.host.terminal.write('\x1b[B\x1b[2K'); // down + clear line
            }
            this.host.terminal.write('\x1b[u'); // restore cursor
            this.renderedLines = 0;
        }
    }

    /**
     * Render the prompt line.
     */
    private renderPrompt(): void {
        this.host.terminal.write('\x1b[2K\r'); // Clear current line
        if (this.selectOptions?.searchable) {
            if (this.filter.length > 0) {
                this.host.terminal.write(
                    `\x1b[36m?\x1b[0m ${this.promptText}: ${this.filter}`,
                );
            } else {
                this.host.terminal.write(
                    `\x1b[36m?\x1b[0m ${this.promptText}: \x1b[2mType to filter...\x1b[0m`,
                );
            }
        } else {
            this.host.terminal.write(`\x1b[36m?\x1b[0m ${this.promptText}:`);
        }
    }

    /**
     * Render the visible slice of the option list.
     */
    private renderOptions(): void {
        const items = this.buildDisplayList();
        const selectables = this.filteredOptions.filter(o => !o.disabled);

        const visibleStart = this.scrollOffset;
        const visibleEnd = Math.min(
            selectables.length,
            this.scrollOffset + this.maxVisible,
        );

        // Show scroll-up indicator
        if (visibleStart > 0) {
            this.host.terminal.write(`\r\n\x1b[2m  \u2191 ${visibleStart} more above\x1b[0m`);
            this.renderedLines++;
        }

        // Render display items, tracking selectable index
        let selectableIdx = 0;
        for (const item of items) {
            if (item.type === 'group-header') {
                if (this.isGroupVisible(item.groupName!, items, visibleStart, visibleEnd)) {
                    this.host.terminal.write(
                        `\r\n\x1b[35m\u2500\u2500 ${item.groupName} \u2500\u2500\x1b[0m`,
                    );
                    this.renderedLines++;
                }
            } else {
                const opt = item.option!;
                if (opt.disabled) {
                    if (this.isDisabledOptionVisible(items, item, visibleStart, visibleEnd)) {
                        this.renderOptionLine(opt, false);
                        this.renderedLines++;
                    }
                } else {
                    if (selectableIdx >= visibleStart && selectableIdx < visibleEnd) {
                        const isSelected = selectableIdx === this.selectedIndex;
                        this.renderOptionLine(opt, isSelected);
                        this.renderedLines++;
                    }
                    selectableIdx++;
                }
            }
        }

        // Show scroll-down indicator
        const remaining = selectables.length - visibleEnd;
        if (remaining > 0) {
            this.host.terminal.write(`\r\n\x1b[2m  \u2193 ${remaining} more below\x1b[0m`);
            this.renderedLines++;
        }
    }

    /**
     * Check if a group header should be visible given the current visible range.
     */
    private isGroupVisible(
        groupName: string,
        items: DisplayItem[],
        visibleStart: number,
        visibleEnd: number,
    ): boolean {
        let selectableIdx = 0;
        for (const item of items) {
            if (item.type === 'option' && !item.option!.disabled) {
                if (
                    item.option!.group === groupName &&
                    selectableIdx >= visibleStart &&
                    selectableIdx < visibleEnd
                ) {
                    return true;
                }
                selectableIdx++;
            }
        }
        return false;
    }

    /**
     * Check if a disabled option should be visible (adjacent to visible selectables).
     */
    private isDisabledOptionVisible(
        items: DisplayItem[],
        disabledItem: DisplayItem,
        visibleStart: number,
        visibleEnd: number,
    ): boolean {
        const idx = items.indexOf(disabledItem);
        let selectableIdx = 0;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type === 'option' && !items[i].option!.disabled) {
                if (i > idx) {
                    return selectableIdx >= visibleStart && selectableIdx < visibleEnd;
                }
                selectableIdx++;
            }
        }
        return selectableIdx > 0 && (selectableIdx - 1) >= visibleStart && (selectableIdx - 1) < visibleEnd;
    }

    /**
     * Render a single option line with checkbox indicator.
     */
    private renderOptionLine(opt: CliMultiSelectOption, isSelected: boolean): void {
        const isChecked = this.checkedState.get(opt.value) === true;
        const label = this.highlightMatch(opt.label);
        const desc = opt.description
            ? ` \x1b[2;3m\u2014 ${opt.description}\x1b[0m`
            : '';

        // Checkbox indicator
        const checkbox = isChecked
            ? '\x1b[32m\u25C9\x1b[0m' // green ◉
            : '\x1b[2m\u25CB\x1b[0m';  // dim ○

        if (opt.disabled) {
            const disabledCheckbox = isChecked
                ? '\x1b[2m\u25C9\x1b[0m'
                : '\x1b[2m\u25CB\x1b[0m';
            this.host.terminal.write(
                `\r\n    ${disabledCheckbox} \x1b[2m${opt.label}${desc} (disabled)\x1b[0m`,
            );
        } else if (isSelected) {
            this.host.terminal.write(
                `\r\n  \x1b[48;5;24m\x1b[38;5;117m\u276F ${checkbox} ${label}${desc}\x1b[0m`,
            );
        } else {
            this.host.terminal.write(
                `\r\n    ${checkbox} ${label}${desc}`,
            );
        }
    }

    /**
     * Highlight the matched filter text in yellow within the label.
     */
    private highlightMatch(label: string): string {
        if (!this.filter || this.filter.length === 0) return label;

        const lower = label.toLowerCase();
        const filterLower = this.filter.toLowerCase();
        const idx = lower.indexOf(filterLower);
        if (idx < 0) return label;

        const before = label.substring(0, idx);
        const match = label.substring(idx, idx + this.filter.length);
        const after = label.substring(idx + this.filter.length);
        return `${before}\x1b[33m${match}\x1b[0m${after}`;
    }

    /**
     * Render the help bar at the bottom.
     */
    private renderHelpBar(): void {
        const checkedCount = this.getCheckedValues().length;
        let help: string;

        if (this.selectOptions?.searchable) {
            if (this.filter.length > 0) {
                const matchCount = this.filteredOptions.filter(o => !o.disabled).length;
                const totalCount = this.options.filter(o => !o.disabled).length;
                help = `${checkedCount} selected \u00B7 ${matchCount} of ${totalCount} matches \u00B7 space to toggle \u00B7 enter to confirm`;
            } else {
                help = `${checkedCount} selected \u00B7 space to toggle \u00B7 a to select all \u00B7 type to filter \u00B7 enter to confirm`;
            }
        } else {
            help = `${checkedCount} selected \u00B7 space to toggle \u00B7 a to select all \u00B7 enter to confirm`;
        }

        this.host.terminal.write(`\r\n    \x1b[2m${help}\x1b[0m`);
        this.renderedLines++;
    }
}

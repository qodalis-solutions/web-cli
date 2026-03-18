import { CliSelectOption, CliSelectOptions } from '@qodalis/cli-core';
import { InputModeHost } from '../input-mode';
import { InputModeBase } from './input-mode-base';

/**
 * Represents an item in the flattened display list.
 * Can be either a selectable option or a non-selectable group header.
 */
interface DisplayItem {
    type: 'option' | 'group-header';
    option?: CliSelectOption;
    groupName?: string;
}

/**
 * Input mode for selecting a single option from a list.
 *
 * Features:
 * - Arrow key navigation with wrap-around
 * - Disabled option skipping
 * - Group headers (non-selectable dividers)
 * - Optional type-to-filter search with highlighted matches
 * - Scroll support for long lists
 * - Description display (dim italic)
 * - onChange callback on navigation
 */
export class SelectInputMode extends InputModeBase<string> {
    private selectedIndex = 0;
    private scrollOffset = 0;
    private maxVisible: number;
    private filter = '';
    private filteredOptions: CliSelectOption[];
    /** Number of lines rendered for the option list + help bar (for clearing) */
    private renderedLines = 0;

    constructor(
        host: InputModeHost,
        resolve: (value: string | null) => void,
        private readonly promptText: string,
        private readonly options: CliSelectOption[],
        private readonly selectOptions?: CliSelectOptions,
    ) {
        super(host, resolve);
        this.filteredOptions = [...options];
        this.maxVisible = Math.min(options.length, host.getTerminalRows() - 4);
    }

    activate(): void {
        // Set default selection if specified
        if (this.selectOptions?.default) {
            const idx = this.filteredOptions.findIndex(
                o => o.value === this.selectOptions!.default,
            );
            if (idx >= 0) {
                this.selectedIndex = idx;
                // Adjust scroll so default is visible
                if (this.selectedIndex >= this.maxVisible) {
                    this.scrollOffset = this.selectedIndex - this.maxVisible + 1;
                }
            }
        } else {
            // Start on first non-disabled option
            this.selectedIndex = this.findNextSelectable(-1, 1);
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

    async handleInput(data: string): Promise<void> {
        if (data === '\x1b[A') {
            // Up arrow
            this.moveSelection(-1);
        } else if (data === '\x1b[B') {
            // Down arrow
            this.moveSelection(1);
        } else if (data === '\r') {
            // Enter — resolve with selected value
            const items = this.buildDisplayList();
            const selectableItems = items.filter(
                i => i.type === 'option' && !i.option!.disabled,
            );
            if (selectableItems.length > 0 && this.selectedIndex < selectableItems.length) {
                const selected = selectableItems[this.selectedIndex];
                this.resolveAndPop(selected.option!.value);
            }
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
        // When not searchable, ignore printable chars
    }

    onResize(cols: number, rows: number): void {
        this.maxVisible = Math.min(this.filteredOptions.length, rows - 4);
        // Adjust scroll offset
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

        // Fire onChange
        const selectables = this.filteredOptions.filter(o => !o.disabled);
        if (this.selectOptions?.onChange && selectables[this.selectedIndex]) {
            this.selectOptions.onChange(selectables[this.selectedIndex].value);
        }

        this.renderAll();
    }

    /**
     * Find the next selectable (non-disabled) option index starting from `from`.
     * Returns 0 if none found.
     */
    private findNextSelectable(from: number, direction: 1 | -1): number {
        const len = this.filteredOptions.length;
        if (len === 0) return 0;
        let idx = from + direction;
        for (let i = 0; i < len; i++) {
            if (idx < 0) idx = len - 1;
            if (idx >= len) idx = 0;
            if (!this.filteredOptions[idx].disabled) return idx;
            idx += direction;
        }
        return 0;
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

        // Move to first non-disabled option
        const selectables = this.filteredOptions.filter(o => !o.disabled);
        if (selectables.length > 0) {
            this.selectedIndex = 0;
        }
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
        // Clear previously rendered lines
        this.clearRenderedLines();

        // Render prompt line
        this.renderPrompt();

        // Build display items and render visible options
        this.renderOptions();

        // Render help bar
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

        // Map selectable index to display-list indices
        // We need to figure out which display items are in the visible window
        // The scroll window is based on the selectable index
        const visibleStart = this.scrollOffset;
        const visibleEnd = Math.min(
            selectables.length,
            this.scrollOffset + this.maxVisible,
        );

        // Show scroll-up indicator
        if (visibleStart > 0) {
            this.host.terminal.write(`\r\n\x1b[2m  ↑ ${visibleStart} more above\x1b[0m`);
            this.renderedLines++;
        }

        // We render display items, tracking which selectable index we're on
        let selectableIdx = 0;
        for (const item of items) {
            if (item.type === 'group-header') {
                // Show group header if any of its options are in visible range
                // Check if the next option's selectable index is in range
                if (this.isGroupVisible(item.groupName!, items, visibleStart, visibleEnd)) {
                    this.host.terminal.write(
                        `\r\n\x1b[35m── ${item.groupName} ──\x1b[0m`,
                    );
                    this.renderedLines++;
                }
            } else {
                const opt = item.option!;
                if (opt.disabled) {
                    // Disabled options are shown but not counted in selectable index
                    // Show if adjacent selectables are visible
                    if (this.isDisabledOptionVisible(items, item, visibleStart, visibleEnd)) {
                        this.renderOptionLine(opt, false, false);
                        this.renderedLines++;
                    }
                } else {
                    // Selectable option
                    if (selectableIdx >= visibleStart && selectableIdx < visibleEnd) {
                        const isSelected = selectableIdx === this.selectedIndex;
                        this.renderOptionLine(opt, isSelected, false);
                        this.renderedLines++;
                    }
                    selectableIdx++;
                }
            }
        }

        // Show scroll-down indicator
        const remaining = selectables.length - visibleEnd;
        if (remaining > 0) {
            this.host.terminal.write(`\r\n\x1b[2m  ↓ ${remaining} more below\x1b[0m`);
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
        // Show disabled options if they're between visible selectable items
        const idx = items.indexOf(disabledItem);
        let selectableIdx = 0;

        // Find the selectable index of the nearest selectable neighbor
        for (let i = 0; i < items.length; i++) {
            if (items[i].type === 'option' && !items[i].option!.disabled) {
                if (i > idx) {
                    // First selectable after this disabled item
                    return selectableIdx >= visibleStart && selectableIdx < visibleEnd;
                }
                selectableIdx++;
            }
        }
        // If no selectable after, check if last selectable before is visible
        return selectableIdx > 0 && (selectableIdx - 1) >= visibleStart && (selectableIdx - 1) < visibleEnd;
    }

    /**
     * Render a single option line.
     */
    private renderOptionLine(
        opt: CliSelectOption,
        isSelected: boolean,
        _isGroupHeader: boolean,
    ): void {
        const label = this.highlightMatch(opt.label);
        const desc = opt.description
            ? ` \x1b[2;3m\u2014 ${opt.description}\x1b[0m`
            : '';

        if (opt.disabled) {
            this.host.terminal.write(
                `\r\n    \x1b[2m${opt.label}${desc} (disabled)\x1b[0m`,
            );
        } else if (isSelected) {
            this.host.terminal.write(
                `\r\n  \x1b[48;5;24m\x1b[38;5;117m\u276F ${label}${desc}\x1b[0m`,
            );
        } else {
            this.host.terminal.write(
                `\r\n    ${label}${desc}`,
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
        let help: string;

        if (this.selectOptions?.searchable) {
            if (this.filter.length > 0) {
                const matchCount = this.filteredOptions.filter(o => !o.disabled).length;
                const totalCount = this.options.filter(o => !o.disabled).length;
                help = `${matchCount} of ${totalCount} matches \u00B7 backspace to clear filter \u00B7 enter to select \u00B7 esc to cancel`;
            } else {
                help = '\u2191/\u2193 navigate \u00B7 type to filter \u00B7 enter to select \u00B7 esc to cancel';
            }
        } else {
            help = '\u2191/\u2193 navigate \u00B7 enter to select \u00B7 esc to cancel';
        }

        this.host.terminal.write(`\r\n    \x1b[2m${help}\x1b[0m`);
        this.renderedLines++;
    }
}

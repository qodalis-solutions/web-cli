import { Component } from '@angular/core';
import { CliOptions, ICliModule } from '@qodalis/cli-core';
import { COMMAND_CATEGORIES, CommandCategory, TOTAL_COMMAND_COUNT } from '../../../../data/commands';

@Component({
    standalone: false,
    selector: 'docs-built-in-commands',
    templateUrl: './built-in-commands.component.html',
})
export class BuiltInCommandsComponent {
    commandCategories: CommandCategory[] = COMMAND_CATEGORIES;
    totalCount: number = TOTAL_COMMAND_COUNT;

    /** Keys and the i18n key of what they do (the same list as the `hotkeys` command) */
    keyboardShortcuts: Array<{ keys: string; action: string }> = [
        { keys: 'Ctrl+C', action: 'k-cancel' },
        { keys: 'Escape', action: 'k-escape' },
        { keys: 'Ctrl+L', action: 'k-clear' },
        { keys: '↑ / ↓', action: 'k-history' },
        { keys: 'Tab', action: 'k-tab' },
        { keys: 'Ctrl+A, Home', action: 'k-home' },
        { keys: 'Ctrl+E, End', action: 'k-end' },
        { keys: 'Ctrl+U', action: 'k-cut-start' },
        { keys: 'Ctrl+K', action: 'k-cut-end' },
        { keys: 'Ctrl+W, Alt+Backspace', action: 'k-cut-word' },
        { keys: 'Ctrl+Y', action: 'k-paste' },
        { keys: 'Ctrl+D, Delete', action: 'k-delete' },
    ];

    tryItModules: ICliModule[] = [];
    tryItOptions: CliOptions = {};
}

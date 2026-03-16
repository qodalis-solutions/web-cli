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

    tryItModules: ICliModule[] = [];
    tryItOptions: CliOptions = {};
}

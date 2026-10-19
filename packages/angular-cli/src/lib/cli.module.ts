import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CliComponent } from './cli/cli.component';
import { CliPanelComponent } from './cli-panel/cli-panel.component';
import { CliPanelIconComponent } from './cli-panel/cli-panel-icon.component';
import { resolveCliProviders } from '.';

@NgModule({
    declarations: [CliComponent, CliPanelComponent, CliPanelIconComponent],
    imports: [CommonModule],
    providers: [resolveCliProviders()],
    exports: [CliPanelComponent, CliComponent],
})
export class CliModule {}

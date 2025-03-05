import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabMenuModule } from 'primeng/tabmenu';
import { MenuModule } from 'primeng/menu';
import { SplitButtonModule } from 'primeng/splitbutton';
import { TooltipModule } from 'primeng/tooltip';
import { CliComponent } from './cli/cli.component';
import { CollapsableContentComponent } from './collapsable-content/collapsable-content.component';
import { CliPanelComponent } from './cli-panel/cli-panel.component';
import { CliTerminalComponent } from './cli-terminal/cli-terminal.component';
import { resolveCliProviders } from '.';

@NgModule({
    declarations: [
        CliComponent,
        CollapsableContentComponent,
        CliPanelComponent,
        CliTerminalComponent,
    ],
    imports: [
        CommonModule,
        //PrimeNG
        ButtonModule,
        TabMenuModule,
        MenuModule,
        SplitButtonModule,
        TooltipModule,
    ],
    providers: [
        resolveCliProviders(),
        { provide: ActivatedRoute, useValue: {} },
    ],
    exports: [CliPanelComponent, CliComponent],
})
export class CliModule {}

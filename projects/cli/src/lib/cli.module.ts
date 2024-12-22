import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CliComponent } from './cli/cli.component';
import { CollapsableContentComponent } from './collapsable-content/collapsable-content.component';
import { CliPanelComponent } from './cli-panel/cli-panel.component';
import { resolveCliProviders } from '.';

@NgModule({
  declarations: [CliComponent, CollapsableContentComponent, CliPanelComponent],
  imports: [CommonModule],
  providers: [resolveCliProviders()],
  exports: [CliPanelComponent, CliComponent],
})
export class CliModule {}

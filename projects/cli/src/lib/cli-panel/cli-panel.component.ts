import { Component, Input } from '@angular/core';
import { CliOptions } from '../cli/models';

export type CliPanelOptions = CliOptions & {
  /**
   * Whether the CLI should be collapsed by default. Defaults to `true`.
   */
  isCollapsed?: boolean;
};

/**
 * A component that displays the CLI on the bottom of page.
 */
@Component({
  selector: 'app-cli-panel',
  templateUrl: './cli-panel.component.html',
  styleUrls: ['./cli-panel.component.sass'],
})
export class CliPanelComponent {
  /**
   * The options for the CLI.
   */
  @Input() options?: CliPanelOptions;
}

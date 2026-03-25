import { Injectable } from '@angular/core';
import { CliPanelComponent } from '@qodalis/angular-cli';

@Injectable({ providedIn: 'root' })
export class PanelRefService {
    panel: CliPanelComponent | null = null;
}

import { Component } from '@angular/core';
import { UTILITY_PLUGINS, GAME_PLUGINS, PluginData } from '../../../../data/plugins';

@Component({
    standalone: false,
    selector: 'docs-plugins',
    templateUrl: './plugins.component.html',
})
export class PluginsComponent {
    utilityPlugins: PluginData[] = UTILITY_PLUGINS;
    gamePlugins: PluginData[] = GAME_PLUGINS;
}

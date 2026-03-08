import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PLUGINS, PluginData } from '../../../../data/plugins';

@Component({
    selector: 'docs-plugin-detail',
    templateUrl: './plugin-detail.component.html',
})
export class PluginDetailComponent implements OnInit {
    plugin: PluginData | undefined;

    constructor(private route: ActivatedRoute) {}

    ngOnInit(): void {
        this.route.params.subscribe((params) => {
            this.plugin = PLUGINS.find((p) => p.id === params['pluginId']);
        });
    }

    get installCommand(): string {
        return `npm install ${this.plugin?.npmPackage}`;
    }

    get usageSnippet(): string {
        if (!this.plugin) return '';
        return `import { ${this.plugin.moduleExport} } from '${this.plugin.moduleImport}';

// Angular: <cli [modules]="[${this.plugin.moduleExport}]" />
// React:   <Cli modules={[${this.plugin.moduleExport}]} />
// Vue:     <Cli :modules="[${this.plugin.moduleExport}]" />`;
    }

    get runtimeInstall(): string {
        return `pkg add ${this.plugin?.npmPackage}`;
    }
}

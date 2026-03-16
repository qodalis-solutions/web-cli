import { Component } from '@angular/core';
import { LANGUAGE_PACKS, PluginData } from '../../../../data/plugins';

@Component({
    standalone: false,
    selector: 'docs-language-packs',
    templateUrl: './language-packs.component.html',
})
export class LanguagePacksComponent {
    languagePacks: PluginData[] = LANGUAGE_PACKS;
}

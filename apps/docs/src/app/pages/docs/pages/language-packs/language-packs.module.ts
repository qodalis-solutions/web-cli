import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguagePacksComponent } from './language-packs.component';

@NgModule({
    declarations: [LanguagePacksComponent],
    imports: [
        CommonModule,
        RouterModule.forChild([
            { path: '', component: LanguagePacksComponent },
        ]),
    ],
})
export class LanguagePacksModule {}

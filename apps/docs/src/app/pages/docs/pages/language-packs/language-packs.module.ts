import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguagePacksComponent } from './language-packs.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [LanguagePacksComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
            { path: '', component: LanguagePacksComponent },
        ]),
    ],
})
export class LanguagePacksModule {}

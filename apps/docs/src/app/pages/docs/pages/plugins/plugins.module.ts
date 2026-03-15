import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PluginsComponent } from './plugins.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [PluginsComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
            { path: '', component: PluginsComponent },
        ]),
    ],
})
export class PluginsModule {}

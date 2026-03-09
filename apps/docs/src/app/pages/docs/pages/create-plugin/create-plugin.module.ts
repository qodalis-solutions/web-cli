import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CreatePluginComponent } from './create-plugin.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [CreatePluginComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
            { path: '', component: CreatePluginComponent },
        ]),
    ],
})
export class CreatePluginModule {}

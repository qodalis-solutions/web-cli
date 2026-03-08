import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CreatePluginComponent } from './create-plugin.component';

@NgModule({
    declarations: [CreatePluginComponent],
    imports: [
        CommonModule,
        RouterModule.forChild([
            { path: '', component: CreatePluginComponent },
        ]),
    ],
})
export class CreatePluginModule {}

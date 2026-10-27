import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AiPluginDevelopmentComponent } from './ai-plugin-development.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [AiPluginDevelopmentComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
            { path: '', component: AiPluginDevelopmentComponent },
        ]),
    ],
})
export class AiPluginDevelopmentModule {}

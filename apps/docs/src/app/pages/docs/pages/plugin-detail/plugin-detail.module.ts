import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CliModule } from '@qodalis/angular-cli';
import { PluginDetailComponent } from './plugin-detail.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [PluginDetailComponent],
    imports: [
        CommonModule,
        CliModule,
        SharedModule,
        RouterModule.forChild([{ path: '', component: PluginDetailComponent }]),
    ],
})
export class PluginDetailModule {}

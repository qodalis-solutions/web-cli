import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PluginDetailComponent } from './plugin-detail.component';

@NgModule({
    declarations: [PluginDetailComponent],
    imports: [
        CommonModule,
        RouterModule.forChild([{ path: '', component: PluginDetailComponent }]),
    ],
})
export class PluginDetailModule {}

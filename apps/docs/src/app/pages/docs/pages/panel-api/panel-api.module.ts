import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PanelApiComponent } from './panel-api.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [PanelApiComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([{ path: '', component: PanelApiComponent }]),
    ],
})
export class PanelApiModule {}

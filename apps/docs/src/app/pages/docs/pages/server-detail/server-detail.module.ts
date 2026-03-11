import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ServerDetailComponent } from './server-detail.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [ServerDetailComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
            { path: '', component: ServerDetailComponent },
        ]),
    ],
})
export class ServerDetailModule {}

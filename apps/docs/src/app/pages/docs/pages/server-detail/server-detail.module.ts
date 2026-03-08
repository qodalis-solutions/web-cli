import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ServerDetailComponent } from './server-detail.component';

@NgModule({
    declarations: [ServerDetailComponent],
    imports: [
        CommonModule,
        RouterModule.forChild([
            { path: '', component: ServerDetailComponent },
        ]),
    ],
})
export class ServerDetailModule {}

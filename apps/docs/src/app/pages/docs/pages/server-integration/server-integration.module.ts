import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ServerIntegrationComponent } from './server-integration.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [ServerIntegrationComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
            { path: '', component: ServerIntegrationComponent },
        ]),
    ],
})
export class ServerIntegrationModule {}

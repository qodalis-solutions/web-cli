import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ServerIntegrationComponent } from './server-integration.component';

@NgModule({
    declarations: [ServerIntegrationComponent],
    imports: [
        CommonModule,
        RouterModule.forChild([
            { path: '', component: ServerIntegrationComponent },
        ]),
    ],
})
export class ServerIntegrationModule {}

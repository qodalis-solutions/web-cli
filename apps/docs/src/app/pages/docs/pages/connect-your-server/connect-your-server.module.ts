import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConnectYourServerComponent } from './connect-your-server.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [ConnectYourServerComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
            { path: '', component: ConnectYourServerComponent },
        ]),
    ],
})
export class ConnectYourServerModule {}

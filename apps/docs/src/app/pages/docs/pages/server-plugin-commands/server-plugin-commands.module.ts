import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ServerPluginCommandsComponent } from './server-plugin-commands.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [ServerPluginCommandsComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
            { path: '', component: ServerPluginCommandsComponent },
        ]),
    ],
})
export class ServerPluginCommandsModule {}

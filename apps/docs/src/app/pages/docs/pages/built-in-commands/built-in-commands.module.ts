import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CliModule } from '@qodalis/angular-cli';
import { BuiltInCommandsComponent } from './built-in-commands.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [BuiltInCommandsComponent],
    imports: [
        CommonModule,
        CliModule,
        SharedModule,
        RouterModule.forChild([{ path: '', component: BuiltInCommandsComponent }]),
    ],
})
export class BuiltInCommandsModule {}

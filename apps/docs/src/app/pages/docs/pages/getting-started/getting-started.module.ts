import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CliModule } from '@qodalis/angular-cli';
import { GettingStartedComponent } from './getting-started.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [GettingStartedComponent],
    imports: [
        CommonModule,
        CliModule,
        SharedModule,
        RouterModule.forChild([{ path: '', component: GettingStartedComponent }]),
    ],
})
export class GettingStartedModule {}

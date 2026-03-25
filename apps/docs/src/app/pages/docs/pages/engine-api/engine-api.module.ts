import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EngineApiComponent } from './engine-api.component';
import { SharedModule } from '../../../../shared/shared.module';
import { CliModule } from '@qodalis/angular-cli';

@NgModule({
    declarations: [EngineApiComponent],
    imports: [
        CommonModule,
        FormsModule,
        CliModule,
        SharedModule,
        RouterModule.forChild([{ path: '', component: EngineApiComponent }]),
    ],
})
export class EngineApiModule {}

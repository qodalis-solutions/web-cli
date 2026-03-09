import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConfigurationComponent } from './configuration.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [ConfigurationComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([{ path: '', component: ConfigurationComponent }]),
    ],
})
export class ConfigurationModule {}

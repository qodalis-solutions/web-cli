import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConfigurationComponent } from './configuration.component';

@NgModule({
    declarations: [ConfigurationComponent],
    imports: [
        CommonModule,
        RouterModule.forChild([{ path: '', component: ConfigurationComponent }]),
    ],
})
export class ConfigurationModule {}

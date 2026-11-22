import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AndroidAppComponent } from './android-app.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [AndroidAppComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([{ path: '', component: AndroidAppComponent }]),
    ],
})
export class AndroidAppModule {}

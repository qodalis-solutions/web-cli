import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [AdminDashboardComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
            { path: '', component: AdminDashboardComponent },
        ]),
    ],
})
export class AdminDashboardModule {}

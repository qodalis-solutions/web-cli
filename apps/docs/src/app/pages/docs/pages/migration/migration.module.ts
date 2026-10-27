import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MigrationComponent } from './migration.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [MigrationComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
            { path: '', component: MigrationComponent },
        ]),
    ],
})
export class MigrationModule {}

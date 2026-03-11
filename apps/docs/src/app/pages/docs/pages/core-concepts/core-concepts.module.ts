import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CliModule } from '@qodalis/angular-cli';
import { CoreConceptsComponent } from './core-concepts.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [CoreConceptsComponent],
    imports: [
        CommonModule,
        CliModule,
        SharedModule,
        RouterModule.forChild([{ path: '', component: CoreConceptsComponent }]),
    ],
})
export class CoreConceptsModule {}

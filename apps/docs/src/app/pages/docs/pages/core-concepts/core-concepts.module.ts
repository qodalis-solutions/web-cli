import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CoreConceptsComponent } from './core-concepts.component';

@NgModule({
    declarations: [CoreConceptsComponent],
    imports: [
        CommonModule,
        RouterModule.forChild([{ path: '', component: CoreConceptsComponent }]),
    ],
})
export class CoreConceptsModule {}

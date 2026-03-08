import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GettingStartedComponent } from './getting-started.component';

@NgModule({
    declarations: [GettingStartedComponent],
    imports: [
        CommonModule,
        RouterModule.forChild([{ path: '', component: GettingStartedComponent }]),
    ],
})
export class GettingStartedModule {}

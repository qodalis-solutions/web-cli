import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PlaygroundComponent } from './playground.component';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
    declarations: [PlaygroundComponent],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([{ path: '', component: PlaygroundComponent }]),
    ],
})
export class PlaygroundModule {}

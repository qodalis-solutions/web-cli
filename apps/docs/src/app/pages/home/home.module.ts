import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CliModule } from '@qodalis/angular-cli';
import { HomeComponent } from './home.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
    declarations: [HomeComponent],
    imports: [
        CommonModule,
        CliModule,
        SharedModule,
        RouterModule.forChild([{ path: '', component: HomeComponent }]),
    ],
})
export class HomeModule {}

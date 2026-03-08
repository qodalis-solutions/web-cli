import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CliModule } from '@qodalis/angular-cli';
import { HomeComponent } from './home.component';

@NgModule({
    declarations: [HomeComponent],
    imports: [
        CommonModule,
        CliModule,
        RouterModule.forChild([{ path: '', component: HomeComponent }]),
    ],
})
export class HomeModule {}

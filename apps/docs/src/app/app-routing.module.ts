import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
    {
        path: '',
        loadChildren: () =>
            import('./pages/home/home.module').then((m) => m.HomeModule),
    },
    {
        path: 'docs',
        loadChildren: () =>
            import('./pages/docs/docs.module').then((m) => m.DocsModule),
    },
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule],
})
export class AppRoutingModule {}

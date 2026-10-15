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
    imports: [
        RouterModule.forRoot(routes, {
            // New pages open at the top; Back/Forward restore the previous position.
            scrollPositionRestoration: 'enabled',
            anchorScrolling: 'enabled',
        }),
    ],
    exports: [RouterModule],
})
export class AppRoutingModule {}

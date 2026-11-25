import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { DocsComponent } from './docs.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
    {
        path: '',
        component: DocsComponent,
        children: [
            {
                path: '',
                redirectTo: 'getting-started',
                pathMatch: 'full',
            },
            {
                path: 'playground',
                loadChildren: () =>
                    import('./pages/playground/playground.module').then(
                        (m) => m.PlaygroundModule,
                    ),
            },
            {
                path: 'getting-started',
                loadChildren: () =>
                    import('./pages/getting-started/getting-started.module').then(
                        (m) => m.GettingStartedModule,
                    ),
            },
            {
                path: 'migration',
                loadChildren: () =>
                    import('./pages/migration/migration.module').then(
                        (m) => m.MigrationModule,
                    ),
            },
            {
                path: 'built-in-commands',
                loadChildren: () =>
                    import('./pages/built-in-commands/built-in-commands.module').then(
                        (m) => m.BuiltInCommandsModule,
                    ),
            },
            {
                path: 'configuration',
                loadChildren: () =>
                    import('./pages/configuration/configuration.module').then(
                        (m) => m.ConfigurationModule,
                    ),
            },
            {
                path: 'core-concepts/:topic',
                loadChildren: () =>
                    import('./pages/core-concepts/core-concepts.module').then(
                        (m) => m.CoreConceptsModule,
                    ),
            },
            {
                path: 'plugins',
                loadChildren: () =>
                    import('./pages/plugins/plugins.module').then(
                        (m) => m.PluginsModule,
                    ),
                pathMatch: 'full',
            },
            {
                path: 'plugins/create-your-own',
                loadChildren: () =>
                    import('./pages/create-plugin/create-plugin.module').then(
                        (m) => m.CreatePluginModule,
                    ),
            },
            {
                path: 'publishing-plugins',
                loadChildren: () =>
                    import(
                        './pages/publishing-plugins/publishing-plugins.module'
                    ).then((m) => m.PublishingPluginsModule),
            },
            {
                path: 'ai-plugin-development',
                loadChildren: () =>
                    import('./pages/ai-plugin-development/ai-plugin-development.module').then(
                        (m) => m.AiPluginDevelopmentModule,
                    ),
            },
            {
                path: 'plugins/:pluginId',
                loadChildren: () =>
                    import('./pages/plugin-detail/plugin-detail.module').then(
                        (m) => m.PluginDetailModule,
                    ),
            },
            {
                path: 'server-integration',
                loadChildren: () =>
                    import(
                        './pages/server-integration/server-integration.module'
                    ).then((m) => m.ServerIntegrationModule),
            },
            {
                path: 'admin-dashboard',
                loadChildren: () =>
                    import('./pages/admin-dashboard/admin-dashboard.module').then(
                        (m) => m.AdminDashboardModule,
                    ),
            },
            {
                path: 'server-plugin-commands',
                loadChildren: () =>
                    import(
                        './pages/server-plugin-commands/server-plugin-commands.module'
                    ).then((m) => m.ServerPluginCommandsModule),
            },
            {
                path: 'server-integration/:server',
                loadChildren: () =>
                    import('./pages/server-detail/server-detail.module').then(
                        (m) => m.ServerDetailModule,
                    ),
            },
            {
                path: 'android-app',
                loadChildren: () =>
                    import('./pages/android-app/android-app.module').then(
                        (m) => m.AndroidAppModule,
                    ),
            },
            {
                path: 'android-app/connect-your-server',
                loadChildren: () =>
                    import(
                        './pages/connect-your-server/connect-your-server.module'
                    ).then((m) => m.ConnectYourServerModule),
            },
            {
                path: 'panel-api',
                loadChildren: () =>
                    import('./pages/panel-api/panel-api.module').then(
                        (m) => m.PanelApiModule,
                    ),
            },
            {
                path: 'engine-api',
                loadChildren: () =>
                    import('./pages/engine-api/engine-api.module').then(
                        (m) => m.EngineApiModule,
                    ),
            },
            {
                path: 'language-packs',
                loadChildren: () =>
                    import('./pages/language-packs/language-packs.module').then(
                        (m) => m.LanguagePacksModule,
                    ),
            },
            {
                // A group of topics without a page of its own: open the first
                path: 'core-concepts',
                redirectTo: 'core-concepts/command-line',
                pathMatch: 'full',
            },
            {
                path: '**',
                component: NotFoundComponent,
            },
        ],
    },
];

@NgModule({
    declarations: [DocsComponent, SidebarComponent, NotFoundComponent],
    imports: [CommonModule, SharedModule, RouterModule.forChild(routes)],
})
export class DocsModule {}

import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';

import { PagesComponent } from './pages.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ProfilesComponent } from '../@core/components/profiles/component';
import { SystemComponent } from './system/system.component';
import { SystemDashboardComponent } from './system/dashboard/dashboard.component';
import { SystemLogsComponent } from './system/logs/logs.component';
import { SystemLogsMQTTLogsComponent } from './system/logs/mqtt/logs.component';
import { SystemLogsMQTTTopicsComponent } from './system/logs/mqtt/topics.component';
import { SystemLogsMQTTBothComponent } from './system/logs/mqtt/both.component';
import { ReadMeComponent } from './readme/component';

import { QueuesComponent } from './queues/component';
import { AppConfigsComponent } from './appconfigs/component';
import { GraphDBInstancesComponent } from '../@core/components/graphdb-instances/component';
import { JobsComponent } from '../@core/components/jobs/component';

const routes: Routes = [{
    path: '',
    component: PagesComponent,
    children: [
        {
            path: 'dashboard',
            component: DashboardComponent,
        },
        {
            path: 'graphdb-instances',
            component: GraphDBInstancesComponent,
        },
        {
            path: 'jobs',
            component: JobsComponent,
        },
        {
            path: 'profiles',
            component: ProfilesComponent,
        },
        {
            path: 'readme',
            component: ReadMeComponent,
        },
        {
            path: 'queues',
            component: QueuesComponent,
        },
        {
            path: 'appconfigs',
            component: AppConfigsComponent,
        },
        {
            path: 'system',
            component: SystemComponent,
            children: [
                {
                    path: 'dashboard',
                    component: SystemDashboardComponent,
                },
                {
                    path: 'logs',
                    component: SystemLogsComponent,
                    children: [
                        {
                            path: 'both',
                            component: SystemLogsMQTTBothComponent,
                        },
                        {
                            path: 'topics',
                            component: SystemLogsMQTTTopicsComponent,
                        },
                        {
                            path: 'logs',
                            component: SystemLogsMQTTLogsComponent,
                        },
                    ],
                },
            ],
        },
        {
            path: 'modal-overlays',
            loadChildren: () => import('./modal-overlays/modal-overlays.module')
                .then(m => m.ModalOverlaysModule),
        },
        {
            path: '',
            redirectTo: 'dashboard',
            pathMatch: 'full',
        },
        {
            path: '**',
            component: ReadMeComponent,
        },
    ],
}];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class PagesRoutingModule {
}

import { NgModule } from '@angular/core';
import { NbMenuModule, NbWindowModule } from '@nebular/theme';

import { ThemeModule } from '../@theme/theme.module';
import { PagesComponent } from './pages.component';
import { DashboardModule } from './dashboard/dashboard.module';
import { PagesRoutingModule } from './pages-routing.module';

import { SystemModule } from './system/system.module';
import { QueuesModule } from './queues/module';

@NgModule({
    imports: [
        PagesRoutingModule,
        ThemeModule,
        NbMenuModule,
        DashboardModule,
        SystemModule,
        QueuesModule,
        NbWindowModule,
    ],
    declarations: [
        PagesComponent,
    ],
})
export class PagesModule {
}

import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import {
    NbButtonModule,
    NbCardModule,
    NbCheckboxModule,
    NbDialogModule,
    NbInputModule,
    NbPopoverModule,
    NbSelectModule,
    NbTabsetModule,
    NbTooltipModule,
    NbWindowModule,
    NbListModule,
    NbAccordionModule,
    NbRouteTabsetModule,
    NbStepperModule,
    NbUserModule,
    NbTreeGridModule,
    NbIconModule,
} from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';

import { SystemComponent } from './system.component';
import { SystemDashboardComponent } from './dashboard/dashboard.component';
import { SystemLogsComponent } from './logs/logs.component';
import { SystemLogsMQTTLogsComponent } from './logs/mqtt/logs.component';
import { SystemLogsMQTTTopicsComponent } from './logs/mqtt/topics.component';
import { SystemLogsMQTTBothComponent } from './logs/mqtt/both.component';

import { MQTTModule } from '../../@core/components/mqtt/mqtt.module';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        NbCardModule, RouterModule, ThemeModule,
        NbButtonModule,
        NbCardModule,
        NbCheckboxModule,
        NbDialogModule,
        NbInputModule,
        NbPopoverModule,
        NbSelectModule,
        NbTabsetModule,
        NbTooltipModule,
        NbWindowModule,
        NbListModule,
        NbAccordionModule,
        NbRouteTabsetModule,
        NbStepperModule,
        NbUserModule,
        NbTreeGridModule,
        NbIconModule,
        MQTTModule,
    ],
    declarations: [
        SystemComponent,
        SystemDashboardComponent,
        SystemLogsComponent,
        SystemLogsMQTTLogsComponent,
        SystemLogsMQTTTopicsComponent,
        SystemLogsMQTTBothComponent,
    ],
    exports: [
        SystemComponent,
        SystemDashboardComponent,
        SystemLogsComponent,
        SystemLogsMQTTLogsComponent,
        SystemLogsMQTTTopicsComponent,
        SystemLogsMQTTBothComponent,
    ],
})
export class SystemModule { }

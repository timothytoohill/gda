import { NgModule } from '@angular/core';
import {
    NbActionsModule,
    NbButtonModule,
    NbCardModule,
    NbTabsetModule,
    NbUserModule,
    NbRadioModule,
    NbSelectModule,
    NbListModule,
    NbIconModule,
    NbCheckboxModule,
    NbDatepickerModule,
    NbInputModule,
    NbSpinnerModule,
    NbAlertModule,
    NbPopoverModule,
    NbSearchModule,
} from '@nebular/theme';


import { ThemeModule } from '../../@theme/theme.module';
import { DashboardComponent } from './dashboard.component';
import { FormsModule } from '@angular/forms';
import { ReadMeComponent } from '../readme/component';
import { AppConfigsComponent } from '../appconfigs/component';
import { MQTTModule } from '../../@core/components/mqtt/mqtt.module';

@NgModule({
    imports: [
        FormsModule,
        ThemeModule,
        NbCardModule,
        NbUserModule,
        NbButtonModule,
        NbTabsetModule,
        NbActionsModule,
        NbRadioModule,
        NbSelectModule,
        NbListModule,
        NbIconModule,
        NbButtonModule,
        NbIconModule,
        NbCheckboxModule,
        NbDatepickerModule,
        NbInputModule,
        NbSpinnerModule,
        NbAlertModule,
        NbPopoverModule,
        NbSearchModule,
        MQTTModule,
    ],
    declarations: [
        DashboardComponent,
        ReadMeComponent,
        AppConfigsComponent,
    ],
})
export class DashboardModule { }

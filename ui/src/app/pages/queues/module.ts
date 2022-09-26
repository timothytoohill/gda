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

import { QueuesComponent } from './component';

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
        QueuesComponent,
    ],
    exports: [
        QueuesComponent,
    ],
})
export class QueuesModule { }

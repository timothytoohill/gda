import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    NbButtonModule,
    NbCardModule,
    NbCheckboxModule,
    NbInputModule,
    NbPopoverModule,
    NbSelectModule,
    NbTabsetModule,
    NbTooltipModule,
    NbListModule,
    NbAccordionModule,
    NbRouteTabsetModule,
    NbStepperModule,
    NbUserModule,
    NbTreeGridModule,
    NbIconModule,
    NbWindowModule,
    NbSpinnerModule,
    NbLayoutModule,
    NbActionsModule,
} from '@nebular/theme';

import { MQTTComponent } from './mqtt.component';
import { MQTTTreeComponent } from './tree/mqtt.tree.component';
import { MQTTLogsComponent } from './logs/mqtt.logs.component';
import { ScrollableContainerComponent } from '../scrollable-container/scrollable.container.component';
import { ProfilesComponent } from '../profiles/component';
import { GraphDBInstancesComponent } from '../graphdb-instances/component';
import { JobsComponent } from '../jobs/component';

@NgModule({
    imports: [
        FormsModule,
        NbCardModule,
        RouterModule,
        NbButtonModule,
        NbCardModule,
        NbCheckboxModule,
        NbInputModule,
        NbPopoverModule,
        NbSelectModule,
        NbTabsetModule,
        NbTooltipModule,
        NbListModule,
        NbAccordionModule,
        NbRouteTabsetModule,
        NbStepperModule,
        NbUserModule,
        NbTreeGridModule,
        NbIconModule,
        CommonModule,
        NbWindowModule.forChild(),
        NbSpinnerModule,
        NbLayoutModule,
        NbActionsModule,
    ],
    declarations: [
        MQTTComponent,
        MQTTTreeComponent,
        MQTTLogsComponent,
        ScrollableContainerComponent,
        ProfilesComponent,
        GraphDBInstancesComponent,
        JobsComponent,
    ],
    exports: [
        MQTTComponent,
        MQTTTreeComponent,
        MQTTLogsComponent,
        ScrollableContainerComponent,
        ProfilesComponent,
        GraphDBInstancesComponent,
        JobsComponent,
    ],
    entryComponents: [
        ProfilesComponent,
        GraphDBInstancesComponent,
        JobsComponent,
    ],
})
export class MQTTModule { }

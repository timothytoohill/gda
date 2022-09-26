import { ModuleWithProviders, NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbAuthModule, NbDummyAuthStrategy } from '@nebular/auth';
import { NbSecurityModule, NbRoleProvider } from '@nebular/security';
import { of as observableOf } from 'rxjs';
import { RouterModule, Routes } from '@angular/router';
import { NbWindowModule } from '@nebular/theme';

import { throwIfAlreadyLoaded } from './module-import-guard';

import {
    AnalyticsService,
    LayoutService,
    StateService,
} from './utils';

import { MQTTModule } from './components/mqtt/mqtt.module';
import { StatusService } from './services/status.service';
import { AppAccountService } from './services/app.account.service';
import { AppStateService } from './services/app.state.service';
import { AppService } from './services/app.service';
import { AppUIService } from './services/app.ui.service';
import { AppCookieService } from './services/app.cookie.service';
import { LoggerService } from './services/logger.service';
import { MQTTService } from './services/mqtt.service';
import { QueuesService } from './services/queues.service';
import { OboeService } from './services/oboe.service';
import { ModalOverlaysModule } from '../pages/modal-overlays/modal-overlays.module';

const DATA_SERVICES = [
];

export class NbSimpleRoleProvider extends NbRoleProvider {
    getRole() {
        // here you could provide any role based on any auth flow
        return observableOf('guest');
    }
}

export const NB_CORE_PROVIDERS = [
    ...DATA_SERVICES,
    ...NbAuthModule.forRoot({

        strategies: [
            NbDummyAuthStrategy.setup({
                name: 'email',
                delay: 3000,
            }),
        ],
        forms: {
            login: {
            },
            register: {
            },
        },
    }).providers,

    NbSecurityModule.forRoot({
        accessControl: {
            guest: {
                view: '*',
            },
            user: {
                parent: 'guest',
                create: '*',
                edit: '*',
                remove: '*',
            },
        },
    }).providers,

    {
        provide: NbRoleProvider, useClass: NbSimpleRoleProvider,
    },
    AnalyticsService,
    LayoutService,
    AppService,
    AppStateService,
    AppAccountService,
    AppUIService,
    AppCookieService,
    LoggerService,
    MQTTService,
    QueuesService,
    OboeService,
    StatusService,
];

@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        MQTTModule,
        FormsModule,
        NbWindowModule.forChild(),
        ModalOverlaysModule,
    ],
    exports: [
        NbAuthModule,
    ],
    declarations: [
    ],
})
export class CoreModule {
    constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
        throwIfAlreadyLoaded(parentModule, 'CoreModule');
    }

    static forRoot(): ModuleWithProviders {
        return <ModuleWithProviders>{
            ngModule: CoreModule,
            providers: [
                ...NB_CORE_PROVIDERS,
            ],
        };
    }
}

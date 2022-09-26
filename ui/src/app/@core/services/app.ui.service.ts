import { Injectable } from '@angular/core';
import { AppStateService, AppConfigurations } from './app.state.service';
import { AppService } from './app.service';
import { LoggerService } from './logger.service';
import { NbWindowService, NbWindowRef } from '@nebular/theme';
import { ProfilesComponent } from '../components/profiles/component';
import { GraphDBInstancesComponent } from '../components/graphdb-instances/component';
import { JobsComponent } from '../components/jobs/component';

@Injectable()
export class AppUIService {
    private profilesWindow: NbWindowRef = null;
    private niWindow: NbWindowRef = null;
    private jobsWindow: NbWindowRef = null;

    constructor(private appService: AppService, private windowService: NbWindowService, private appStateService: AppStateService, private loggerService: LoggerService) {
    }

    showProfiles() {
        if (ProfilesComponent.isLoaded) {

        } else {
            if (this.profilesWindow == null) {
                this.profilesWindow = this.windowService.open(ProfilesComponent, {
                    title: 'Profiles',
                    windowClass: 'noPaddingOrMargins',
                    context: {
                        isWindow: true,
                    },
                });
                this.profilesWindow.onClose.subscribe(() => {
                    this.profilesWindow = null;
                });
                ProfilesComponent.setWindowRef(this.profilesWindow);
            } else {
                this.profilesWindow.maximize();
            }
        }
    }

    showNI() {
        if (GraphDBInstancesComponent.isLoaded) {

        } else {
            if (this.niWindow == null) {
                this.niWindow = this.windowService.open(GraphDBInstancesComponent, {
                    title: 'Graph DB Instances',
                    windowClass: 'windowClassNI',
                    context: {
                        isWindow: true,
                    },
                });
                this.niWindow.onClose.subscribe(() => {
                    this.niWindow = null;
                });
                GraphDBInstancesComponent.setWindowRef(this.niWindow);
            } else {
                this.niWindow.maximize();
            }
        }
    }

    showJobs() {
        if (JobsComponent.isLoaded) {

        } else {
            if (this.jobsWindow == null) {
                this.jobsWindow = this.windowService.open(JobsComponent, {
                    title: 'Jobs',
                    windowClass: 'windowClassNI',
                    context: {
                        isWindow: true,
                    },
                });
                this.jobsWindow.onClose.subscribe(() => {
                    this.jobsWindow = null;
                });
                JobsComponent.setWindowRef(this.jobsWindow);
            } else {
                this.jobsWindow.maximize();
            }
        }
    }
}

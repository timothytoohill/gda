import { Component, OnInit, AfterViewChecked } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { AppService } from './@core/services/app.service';
import { AppAccountService } from './@core/services/app.account.service';
import { AppStateService } from './@core/services/app.state.service';
import { StatusService } from './@core/services/status.service';
import { NbSidebarService } from '@nebular/theme';
import { timer } from 'rxjs';

@Component({
    selector: 'app',
    template: '<router-outlet></router-outlet>',
})
export class AppComponent implements OnInit, AfterViewChecked {
    private toggleSidebar = timer(2000);
    private isToggled: boolean = false;

    constructor(private appStateService: AppStateService, private appAccountService: AppAccountService, private themeService: NbThemeService, private appService: AppService, private statusService: StatusService, private sidebarService: NbSidebarService) {
        this.themeService.changeTheme('app');
        this.appService.init();
        this.appAccountService.init().then(() => {
            this.appService.loadGraphDBInstances().then(() => {
                if (this.appStateService.account.graphDBEndpoint == '') {
                    if (this.appStateService.graphDBInstances.length > 0) {
                        this.appStateService.account.graphDBEndpoint = this.appStateService.graphDBInstances[0]['Endpoint'];
                    }
                }
            });
            this.appStateService.resolveInitialized();
        });
    }

    ngOnInit() {
    }

    ngAfterViewChecked() {
        /*
        if (!this.isToggled) {
          this.isToggled = true;
          this.toggleSidebar.subscribe(() => {
            this.sidebarService.compact('menu-sidebar');
          });
        }
        */
    }
}

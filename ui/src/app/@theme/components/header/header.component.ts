import { Component, OnDestroy, OnInit } from '@angular/core';
import { NbMediaBreakpointsService, NbMenuService, NbSidebarService, NbThemeService } from '@nebular/theme';

import { LayoutService } from '../../../@core/utils';
import { map, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { StatusService } from '../../../@core/services/status.service';
import { AppStateService } from '../../../@core/services/app.state.service';
import { AppUIService } from '../../../@core/services/app.ui.service';

import { MiscUtils } from '../../../@core/utils/miscutils';

@Component({
    selector: 'ngx-header',
    styleUrls: ['./header.component.scss'],
    templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit, OnDestroy {
    private destroy$: Subject<void> = new Subject<void>();
    userPictureOnly: boolean = false;
    user: any;

    themes = [
        {
            value: 'default',
            name: 'Light',
        },
        {
            value: 'app',
            name: 'Default',
        },
        {
            value: 'cosmic',
            name: 'Cosmic',
        },
        {
            value: 'corporate',
            name: 'Corporate',
        },
    ];

    currentTheme = 'app';

    userMenu = [{ title: 'Use a Profile' }, { title: 'Use Anonymous' }];

    constructor(private sidebarService: NbSidebarService, private menuService: NbMenuService, private themeService: NbThemeService, private layoutService: LayoutService,
        private breakpointService: NbMediaBreakpointsService,
        public statusService: StatusService,
        public appStateService: AppStateService,
        public appUIService: AppUIService) {
    }

    ngOnInit() {
        this.currentTheme = this.themeService.currentTheme;

        const { xl } = this.breakpointService.getBreakpointsMap();
        this.themeService.onMediaQueryChange()
            .pipe(
                map(([, currentBreakpoint]) => currentBreakpoint.width < xl),
                takeUntil(this.destroy$),
            )
            .subscribe((isLessThanXl: boolean) => this.userPictureOnly = isLessThanXl);

        this.themeService.onThemeChange()
            .pipe(
                map(({ name }) => name),
                takeUntil(this.destroy$),
            )
            .subscribe(themeName => this.currentTheme = themeName);
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    changeTheme(themeName: string) {
        this.themeService.changeTheme(themeName);
    }

    toggleSidebar(): boolean {
        this.sidebarService.toggle(true, 'menu-sidebar');
        this.layoutService.changeLayoutSize();

        return false;
    }

    navigateHome() {
        this.menuService.navigateHome();
        return false;
    }

    getGraphDBClusterAddress() {
        return this.appStateService.getEndpointShortName(this.appStateService.account.graphDBEndpoint);
    }

    getAPIClusterAddress() {
        return this.appStateService.getEndpointShortName(MiscUtils.getAddress(this.appStateService.appConfigs.appServices["api"].address));
    }

    getJobClusterAddress() {
        return this.appStateService.getEndpointShortName(MiscUtils.getAddress(this.appStateService.appConfigs.appServices["api"].address));
    }

    getComputeClusterAddress() {
        return this.appStateService.getEndpointShortName(MiscUtils.getAddress(this.appStateService.appConfigs.appServices["api"].address));
    }
}

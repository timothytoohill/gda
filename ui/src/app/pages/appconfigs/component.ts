import { Component, OnDestroy, OnInit, AfterViewInit } from '@angular/core';
import { ShowcaseDialogComponent } from '../modal-overlays/dialog/showcase-dialog/showcase-dialog.component';
import { NbDialogService, NbTabsetComponent } from '@nebular/theme';
import { LoggerService } from '../../@core/services/logger.service';
import { AppService } from '../../@core/services/app.service';
import { AppAccountService } from '../../@core/services/app.account.service';
import { AppStateService } from '../../@core/services/app.state.service';
import { MiscUtils } from '../../@core/utils/miscutils';
import { StatusService, StatusState } from '../../@core/services/status.service';

@Component({ selector: 'appconfigs', styleUrls: ['./component.scss'], templateUrl: './component.html' })
export class AppConfigsComponent implements OnDestroy, AfterViewInit {
    public password = '';
    public currentConfigs = '';
    public defaultConfigs = '';

    constructor(private appAccountService: AppAccountService, private dialogService: NbDialogService, private loggerService: LoggerService, private appService: AppService, public statusService: StatusService, private appStateService: AppStateService) {
    }

    ngAfterViewInit() {
        //this.showMessage('Password required', 'For now, a password is required to edit system configs.');
        this.ok();
    }

    ngOnDestroy() {
    }

    ok() {
        if (this.isPasswordGood()) {
            this.defaultConfigs = JSON.stringify(this.appAccountService.getDefaultAccountConfigs(), null, 4);
            this.currentConfigs = JSON.stringify(this.appStateService.account, null, 4);
        }
    }

    save() {
        if (this.isPasswordGood()) {
            const newConfigs = JSON.parse(this.currentConfigs);
            MiscUtils.mergeDictionaries(newConfigs, this.appStateService.account);
            this.appStateService.setAppConfigs(newConfigs['appConfigs']);
        } else {
            this.showMessage('Password', 'Please enter a password.');
        }
    }

    isPasswordGood() {
        //return this.hashPass(this.password) == 5330019721054625;
        return true;
    }

    hashPass(str, seed = 0) {
        let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
        for (let i = 0, ch; i < str.length; i++) {
            ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
        h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
        return 4294967296 * (2097151 & h2) + (h1 >>> 0);
    }

    showMessage(title: string, message: string, showCancel = false, okCallback = null, cancelCallback = null) {
        this.dialogService.open(ShowcaseDialogComponent, {
            context: {
                title: title,
                message: message,
                okCallback: okCallback,
                showCancel: showCancel,
            },
        });
    }


}

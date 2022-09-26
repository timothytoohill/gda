import { Component, OnDestroy, OnInit, AfterViewInit, Input } from '@angular/core';
import { LoggerService } from '../../../@core/services/logger.service';
import { AppService } from '../../../@core/services/app.service';
import { AppAccountService } from '../../../@core/services/app.account.service';
import { AppStateService } from '../../../@core/services/app.state.service';
import { StatusService } from '../../../@core/services/status.service';
import { NbWindowRef, NbDialogService } from '@nebular/theme';
import { ShowcaseDialogComponent } from '../../../pages/modal-overlays/dialog/showcase-dialog/showcase-dialog.component';
import { timer } from 'rxjs';

@Component({ selector: 'profiles', styleUrls: ['./component.scss'], templateUrl: './component.html' })
export class ProfilesComponent implements OnInit, OnDestroy, AfterViewInit {
    public static isLoaded = false;
    public wTitle: string = '';
    public profileName: string = '';

    private static windowRef: NbWindowRef = null;
    private loadTimer = timer(100);

    @Input() isWindow: boolean = false;

    constructor(private dialogService: NbDialogService, private appAccountService: AppAccountService, private loggerService: LoggerService, private appService: AppService, public statusService: StatusService, public appStateService: AppStateService) {
    }

    ngOnInit() {
        ProfilesComponent.isLoaded = true;
    }

    ngOnDestroy() {
        ProfilesComponent.isLoaded = false;
    }

    ngAfterViewInit() {
        this.loadTimer.subscribe(() => {
            this.appStateService.init().then(() => {
                if (this.isWindow) {

                } else {
                    this.wTitle = 'Profiles';
                }

                this.getAccounts();

            });
        });
    }

    useAccount(account) {
        this.appAccountService.setAccount(account);
        this.showMessage('Profile set', 'Your profile has been set to \'' + account.name + '\'. The browser\'s local storage is used to remember which profile you\'ve set, so it will be remembered this next time you log in from this computer using this browser.');
        ProfilesComponent.tryClose();
    }

    async addAccount() {
        if (this.appAccountService.doesAccountExist(this.profileName)) {
            this.showMessage('Account exists', 'If you want to use this name, you will have to delete the existing account first.');
        } else {
            const newAcct = this.appAccountService.getDefaultAccountConfigs();
            newAcct.name = this.profileName;
            newAcct.isAnonymous = false;
            await this.appAccountService.saveAccount(newAcct);
        }
    }

    deleteAccount(account) {
        this.showMessage('Are you sure?', 'Are you sure you want to delete this account?', true, () => {
            this.appAccountService.deleteAccount(account);
        });
    }

    getAccounts() {
        this.appAccountService.getAllAccounts();
    }

    close() {
        ProfilesComponent.tryClose();
    }

    public static setWindowRef(ref: NbWindowRef) {
        this.windowRef = ref;
    }

    public static tryClose() {
        if (this.windowRef == null) {

        } else {
            this.windowRef.close();
        }
    }

    useAnonymously() {
        this.appAccountService.setAnonymousAccount(true);
        ProfilesComponent.tryClose();
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

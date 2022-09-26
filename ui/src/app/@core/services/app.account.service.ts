import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { AppStateService, AppConfigurations } from './app.state.service';
import { AppService } from './app.service';
import { AppCookieService } from './app.cookie.service';
import { LoggerService } from './logger.service';
import { StatusService } from './status.service';

import { MiscUtils } from '../utils/miscutils';

export interface AppAccount {
    name?: string;
    id?: string;
    isAnonymous: boolean;
    [key: string]: any;

    loadResultsTable: boolean; // true
    queryName: string; // = "myQueryName";
    showGraphEdgeWarningMessage: boolean; // = true;
    showNonEdgeOrNodeMessage: boolean; // = true;
    showQueryErrorMessageBox: boolean; // = false;
    switchToGraphOnQueryRun: boolean; // = false;
    confirmSaveQuery: boolean; // = true;
    graphDBEndpoint: string;
    s3LoadLocation: string;
    graphDBARN: string;
    graphDBLoadPriority: string;
    uiMaxEdges: number; // = 100;
    animateGraph: boolean; // = true;
    stopAnimationOnMouseOver: boolean; // = false;
    loadGraphWhileStreaming: boolean; // = false;
    loadGraphIncrement: number; // = 100;
    mqLogsAutoScroll: boolean; // true
    mqTreeAutoExpand: boolean; // true
    mqTreeAutoPrune: boolean;
    autoSaveQuery: boolean;
    currentGraphDBLoadID: string;

    appConfigs?: AppConfigurations;
}

@Injectable()
export class AppAccountService {
    private saveTimer = timer(10000, 10000);
    private previousAccount: AppAccount = null;
    public anonymous = 'Anonymous';
    private initPromise: Promise<any> = null;
    private isSavingAccount: boolean = false;
    public isGettingAccounts: boolean = false;

    constructor(private appCookieService: AppCookieService, private appService: AppService, private statusService: StatusService, private appStateService: AppStateService, private loggerService: LoggerService) {
        this.setAnonymousAccount();
    }

    public init(): Promise<any> {
        if (this.initPromise == null) {
            this.initPromise = new Promise<void>((resolve, reject) => {
                this.appService.init().then(() => {
                    this.setAnonymousAccount();
                    this.saveTimer.subscribe(() => {
                        if (this.appStateService.account.isAnonymous) {

                        } else {
                            if (this.hasAccountChanged() && !this.isSavingAccount) {
                                this.loggerService.log('Detected user account change. Triggering save...');
                                this.updatePreviousAccount();
                                this.saveAccount();
                            }
                        }
                    });

                    this.setAccountFromCookie().then(() => {
                        resolve();
                    });
                });
            });
        }
        return this.initPromise;
    }

    async getAllAccounts() {
        if (this.isGettingAccounts) {

        } else {
            const status = await this.statusService.setStatus('Getting accounts...');
            this.isGettingAccounts = true;
            this.appService.makeStreamingAPIPOSTCall('/accounts').subscribe((response) => {
                if (response.isSuccess) {
                    if (this.appStateService.allAccounts.length > 0) {
                        this.appStateService.allAccounts = [];
                    }
                    for (const index in response.results) {
                        const result = response.results[index];
                        const acct = JSON.parse(result.data);
                        delete acct['appConfigs']['appName'];
                        this.appStateService.allAccounts.push(acct);
                    }
                }
            }, (error) => {
                this.isGettingAccounts = false;
                status.setErrorStatus('Error getting accounts: ' + MiscUtils.getString(error));
            }, () => {
                this.isGettingAccounts = false;
                status.setCompleteStatus('Done getting accounts.');
            });
        }
    }

    async getAccount(name: string) {
        const status = await this.statusService.setStatus('Getting account for ' + name + '...');
        const data = { name: name };
        return new Promise<void>((resolve, reject) => {
            this.appService.makeStreamingAPIPOSTCall('/my-account', data).subscribe((response) => {
                if (response.isSuccess) {
                    const result = response.results[0];
                    const acct = JSON.parse(result.data);
                    delete acct['appConfigs'];
                    this.setAccount(acct);
                }
            }, (error) => {
                status.setErrorStatus('Could not get account: ' + MiscUtils.getString(error));
                resolve();
            }, () => {
                status.setCompleteStatus('Done getting account.');
                resolve();
            });
        });
    }

    async saveNewAccount() {
        const newAcct = this.getDefaultAccountConfigs();
        return await this.saveAccount(newAcct);
    }

    async saveAccount(account: AppAccount = null) {
        if (!this.isSavingAccount) {
            this.isSavingAccount = true;
            let acct = account;
            if (acct == null) {
                acct = this.appStateService.account;
            }
            const status = await this.statusService.setStatus('Saving account...');
            this.appService.makeStreamingAPIPOSTCall('/save-account', acct).subscribe((response) => {
            }, (error) => {
                status.setErrorStatus('Could not save account: ' + MiscUtils.getString(error));
                this.isSavingAccount = false;
            }, () => {
                status.setCompleteStatus('Saved account successfully.');

                if (this.doesAccountExist(acct.name)) {

                } else {
                    this.appStateService.allAccounts.push(acct);
                }
                this.isSavingAccount = false;
            });
        }
    }

    async deleteAccount(account: AppAccount) {
        const status = await this.statusService.setStatus('Deleting account...');
        this.appService.makeStreamingAPIPOSTCall('/delete-account', account).subscribe((response) => {
        }, (error) => {
            status.setErrorStatus('Error deleting account: ' + MiscUtils.getString(error));
        }, () => {
            status.setCompleteStatus('Done deleting account.');
            const all = this.appStateService.allAccounts;
            this.appStateService.allAccounts = [];
            for (const key in all) {
                const a = all[key];
                if (a.name == account.name) {

                } else {
                    this.appStateService.allAccounts.push(a);
                }
            }
        });
    }

    doesAccountExist(name: string) {
        for (const index in this.appStateService.allAccounts) {
            const acct = this.appStateService.allAccounts[index];
            if (acct.name == name) {
                return true;
            }
        }
        return false;
    }

    setAccount(account: AppAccount) {
        const acct = {};
        MiscUtils.mergeDictionaries(account, this.appStateService.account);
        this.setAppConfigsFromAccount(this.appStateService.account);
        this.setCookieFromAccount(account);
        this.updatePreviousAccount();
    }

    updatePreviousAccount() {
        this.previousAccount = this.getDefaultAccountConfigs();
        MiscUtils.mergeDictionaries(this.appStateService.account, this.previousAccount);
    }

    setAccountFromCookie() {
        const name = this.appCookieService.getCookie('account');
        if (name == '' || name == this.anonymous) {
            return Promise.resolve(null);
        } else {
            return this.getAccount(name);
        }
    }

    setCookieFromAccount(account: AppAccount = null) {
        let acct = account;
        if (acct == null) {
            acct = this.appStateService.account;
        }
        this.appCookieService.setCookie('account', acct.name);
    }

    setAnonymousAccount(deleteCookie = false) {
        this.appStateService.account = this.getAnonymousAccount();
        if (deleteCookie) {
            this.appCookieService.deleteCookie('account');
        }
        this.updatePreviousAccount();
    }

    setAppConfigsFromAccount(account: AppAccount) {
        MiscUtils.mergeDictionaries(account.appConfigs, this.appStateService.appConfigs);
    }

    private hasAccountChanged(): boolean {
        if (this.previousAccount == null) {
            this.previousAccount = this.getDefaultAccountConfigs();
            MiscUtils.mergeDictionaries(this.appStateService.account, this.previousAccount);
            return true;
        } else {
            if (!MiscUtils.areDictionariesTheSame(this.appStateService.account, this.previousAccount)) {
                return true;
            }
        }
        return false;
    }

    private getAnonymousAccount(): AppAccount {
        const anon = this.getDefaultAccountConfigs();
        this.setAppConfigsFromAccount(anon);
        return anon;
    }

    public getNewQueryName() {
        return 'myQuery-' + MiscUtils.getRandomNumber(1, 1000).toString();
    }

    public getDefaultGraphDBEndpoint() {
        if (this.appStateService.appConfigs != null) {
            return this.appStateService.appConfigs['appServices']['gremlinserver']['address'];
        }
        return '';
    }

    public getDefaultAccountConfigs(): AppAccount {
        const configs: AppAccount = {
            name: this.anonymous,
            id: this.appStateService.thisInstanceID,
            isAnonymous: true,

            loadResultsTable: true,
            queryName: this.getNewQueryName(),
            showGraphEdgeWarningMessage: true,
            showNonEdgeOrNodeMessage: true,
            showQueryErrorMessageBox: false,
            switchToGraphOnQueryRun: true,
            confirmSaveQuery: true,
            graphDBEndpoint: '',
            s3LoadLocation: '',
            graphDBARN: '',
            graphDBLoadPriority: 'MEDIUM',
            uiMaxEdges: 100,
            animateGraph: true,
            stopAnimationOnMouseOver: false,
            loadGraphWhileStreaming: false,
            loadGraphIncrement: 100,
            mqLogsAutoScroll: true,
            mqTreeAutoExpand: true,
            mqTreeAutoPrune: false,
            autoSaveQuery: true,
            currentGraphDBLoadID: '',

            appConfigs: this.appStateService.getDefaultAppConfigs(),
        };
        return configs;
    }
}

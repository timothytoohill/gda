import { Component, OnDestroy, OnInit, AfterViewInit, Input, ViewChild } from '@angular/core';
import { LoggerService } from '../../../@core/services/logger.service';
import { AppService } from '../../../@core/services/app.service';
import { AppAccountService } from '../../../@core/services/app.account.service';
import { AppStateService } from '../../../@core/services/app.state.service';
import { StatusService } from '../../../@core/services/status.service';
import { NbWindowRef, NbDialogService } from '@nebular/theme';
import { ShowcaseDialogComponent } from '../../../pages/modal-overlays/dialog/showcase-dialog/showcase-dialog.component';
import { timer, Subscription } from 'rxjs';
import { MQTTLogsComponent } from '../mqtt/logs/mqtt.logs.component';


@Component({ selector: 'graphdb-instances', styleUrls: ['./component.scss'], templateUrl: './component.html' })
export class GraphDBInstancesComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('mqLogs', { static: false }) private mqLogs: MQTTLogsComponent;

    public static isLoaded = false;
    public wTitle: string = '';
    public instanceName: string = '';

    private static windowRef: NbWindowRef = null;
    private loadTimer = timer(100);
    private refreshTimer = timer(5000, 5000);
    private refreshTimerSubscription: Subscription = null;
    private isRefreshing = false;
    private isAddingInstance = false;

    @Input() isWindow: boolean = false;

    constructor(private dialogService: NbDialogService, private appAccountService: AppAccountService, private loggerService: LoggerService, private appService: AppService, public statusService: StatusService, public appStateService: AppStateService) {
    }

    ngOnInit() {
        GraphDBInstancesComponent.isLoaded = true;
    }

    ngOnDestroy() {
        GraphDBInstancesComponent.isLoaded = false;
        if (this.refreshTimerSubscription === null) {

        } else {
            this.refreshTimerSubscription.unsubscribe();
        }
        this.mqLogs.mqttUnsubscribeAll();
    }

    ngAfterViewInit() {
        this.loadTimer.subscribe(() => {
            this.appStateService.init().then(() => {
                if (this.isWindow) {

                } else {
                    this.wTitle = 'Graph DB Instances';
                }

                this.refresh();

                const id = this.appStateService.getUserID();
                const appTopicAPI = this.appStateService.getAppTopicAPI();
                const appTopicAPIForThisUser = this.appStateService.getAppTopicAPIForThisUser();

                const dashboardTopics = [appTopicAPIForThisUser];
                const stripTopics = [appTopicAPI];
                const replaceTopics = [["/.*/.*/" + id, "server"]];

                this.mqLogs.subscribeToTopics(dashboardTopics, stripTopics, replaceTopics);
            });
        });

        this.refreshTimerSubscription = this.refreshTimer.subscribe(() => {
            this.refresh(false);
        });
    }

    properties(instance) {
        const x = $('#json-renderer-nep');
        (x as any).jsonViewer(instance, { rootCollapsable: false });
    }

    refresh(showMessage = true, force = false) {
        if (this.isRefreshing && !force) {

        } else {
            this.isRefreshing = true;
            this.appService.loadGraphDBInstances(showMessage).then(() => {
                for (const index in this.appStateService.graphDBInstances) {
                    const instance = this.appStateService.graphDBInstances[index];
                    if (instance['DBClusterMembers'].length <= 0 && instance['Status'] == 'available') {
                        this.addInstance(instance);
                    }
                }
                this.isRefreshing = false;
            });
        }
    }

    use(instance) {
        this.appStateService.account.graphDBEndpoint = instance.Endpoint;
        this.showMessage('Using ' + this.appStateService.getEndpointShortName(instance.Endpoint), 'You are now using ' + instance.Endpoint + '.');
    }

    async add() {
        if (this.appStateService.account.isAnonnymous) {
            this.showMessage('Please create profile', 'Please create a profile to create a Graph DB cluster. Profiles do not require passwords and are used for tracking purposes only.');
        } else if (this.instanceName == '' || this.instanceName.indexOf('gda') >= 0) {
            this.showMessage('Please name your instance', 'Please give your instance a unique name. The name may not contain \'gda\'.');
        } else {
            const data = { name: this.instanceName };
            this.appService.createGraphDBCluster(data).then(() => {
                this.refresh(false, true);
            });
        }
    }

    async addInstance(data) {
        if (this.isAddingInstance) {
        } else {
            this.isAddingInstance = true;
            this.appService.createGraphDBInstance(data).then(() => {
                this.isAddingInstance = false;
                this.refresh(false, true);
            });
        }
    }

    delete(instance) {
        this.showMessage('Are you sure?', 'Are you sure you want to delete this instance?', true, () => {
            this.appService.deleteGraphDBInstance(instance).then(() => {
                this.refresh(false, true);
            });
        });
    }

    getAccounts() {
        this.appAccountService.getAllAccounts();
    }

    close() {
        GraphDBInstancesComponent.tryClose();
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

    load(obj) {

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

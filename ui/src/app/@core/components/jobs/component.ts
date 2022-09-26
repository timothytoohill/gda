import { Component, OnDestroy, OnInit, AfterViewInit, Input, ViewChild } from '@angular/core';
import { LoggerService } from '../../../@core/services/logger.service';
import { AppService } from '../../../@core/services/app.service';
import { AppAccountService } from '../../../@core/services/app.account.service';
import { AppStateService, Job, JobType, JobState, EntityResolutionAlgorithm } from '../../../@core/services/app.state.service';
import { MiscUtils } from '../../../@core/utils/miscutils';
import { StatusService } from '../../../@core/services/status.service';
import { NbWindowRef, NbDialogService } from '@nebular/theme';
import { ShowcaseDialogComponent } from '../../../pages/modal-overlays/dialog/showcase-dialog/showcase-dialog.component';
import { timer, Subscription } from 'rxjs';
import { MQTTLogsComponent } from '../mqtt/logs/mqtt.logs.component';


@Component({ selector: 'graphdb-instances', styleUrls: ['./component.scss'], templateUrl: './component.html' })
export class JobsComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('mqLogs', { static: false }) private mqLogs: MQTTLogsComponent;

    public static isLoaded = false;
    public wTitle: string = '';
    public job: Job = null;
    private static windowRef: NbWindowRef = null;
    private loadTimer = timer(100);
    private refreshTimer = timer(5000, 5000);
    private refreshTimerSubscription: Subscription = null;
    private isRefreshing = false;
    public jobDetailsName: string = '';
    public allowedInstances = [];
    public learnedNodeProperties = {};
    public usePropertyQuery = {};
    public entityProperties = [];

    @Input() isWindow: boolean = false;

    constructor(private dialogService: NbDialogService, private appAccountService: AppAccountService, private loggerService: LoggerService, private appService: AppService, public statusService: StatusService, public appStateService: AppStateService) {
        this.job = this.getJobDefaults();
    }

    ngOnInit() {
        JobsComponent.isLoaded = true;
    }

    ngOnDestroy() {
        JobsComponent.isLoaded = false;
        if (this.refreshTimerSubscription === null) {

        } else {
            this.refreshTimerSubscription.unsubscribe();
        }
        this.mqLogs.mqttUnsubscribeAll();
    }

    ngAfterViewInit() {
        this.loadTimer.subscribe(() => {
            this.appStateService.init().then(() => {
                this.job = this.getJobDefaults();

                if (this.isWindow) {

                } else {
                    this.wTitle = 'Jobs';
                }

                this.refresh();

                const id = this.appStateService.getUserID();
                const appTopicAPI = this.appStateService.getAppTopicAPI();
                const appTopicUIForThisUser = this.appStateService.getAppTopicUIForThisUser();
                const appTopicAPIForThisUser = this.appStateService.getAppTopicAPIForThisUser();

                const dashboardTopics = [appTopicUIForThisUser + '/#', appTopicAPIForThisUser];
                const stripTopics = [appTopicUIForThisUser + "/", appTopicAPI];
                const replaceTopics = [["/.*/.*/" + id, "server"]];

                this.mqLogs.subscribeToTopics(dashboardTopics, stripTopics, replaceTopics);

                this.appService.loadSavedQueries().then(() => {
                    for (const si in this.appStateService.savedQueries) {
                        const sq = this.appStateService.savedQueries[si];
                        MiscUtils.mergeDictionaries(sq.learnedNodeProperties, this.learnedNodeProperties);
                    }
                    for (const propName in this.learnedNodeProperties) {
                        for (const entityType in this.learnedNodeProperties[propName]) {
                            this.entityProperties.push(entityType + ' . ' + propName);
                        }
                    }
                });

                this.appService.loadGraphDBInstances().then(() => {
                    for (const i in this.appStateService.graphDBInstances) {
                        const instance = this.appStateService.graphDBInstances[i];
                        if (instance['Endpoint'].indexOf('gda') < 0) {
                            this.allowedInstances.push(instance);
                        }
                    }
                });
            });
        });

        this.refresh(false);
        this.refreshTimerSubscription = this.refreshTimer.subscribe(() => {
            //this.refresh(false);
        });
    }

    explainLoad() {
        this.showMessage('Loading', 'You can load an instance using a query that reads nodes/edges from another database, or you can use the Graph DB Loader in the dashboard.');
    }

    getKeys(obj: any) {
        if (obj == null) {
            return [];
        }
        if (obj === this.usePropertyQuery) {
            return [];
        }
        return Object.keys(obj);
    }

    changeSelectedQuery1() {
        if (this.job.selectedQuery1 == null) {

        } else if (JSON.stringify(this.job.selectedQuery1) == JSON.stringify(this.usePropertyQuery)) {
            this.job.selectedQuery1 = this.usePropertyQuery;
            this.changeSelectedEntityProperty1();
        } else {
            if (this.getKeys(this.job.selectedQuery1).length > 0) {
                this.job.query1 = this.job.selectedQuery1['query'];
                this.job.sourceInstance = this.getGraphDBInstanceEndpointReference(this.job.selectedQuery1['graphDBEndpoint']);
            }
        }
    }

    changeSelectedQuery2() {
        if (this.job.selectedQuery2 == null) {

        } else if (JSON.stringify(this.job.selectedQuery2) == JSON.stringify(this.usePropertyQuery)) {
            this.job.selectedQuery2 = this.usePropertyQuery;
            this.changeSelectedEntityProperty2();
        } else {
            if (this.getKeys(this.job.selectedQuery2).length > 0) {
                this.job.query2 = this.job.selectedQuery2['query'];
                this.job.sourceInstance = this.getGraphDBInstanceEndpointReference(this.job.selectedQuery2['graphDBEndpoint']);
            }
        }
    }

    changeSelectedEntityProperty1() {
        if (this.job.entityProperty1.length > 0) {
            const sp = this.job.entityProperty1.split(' . ');
            this.job.query1 = 'g.V().hasLabel(\'' + sp[0] + '\')';
            this.job.selectedProperty1 = sp[1];
        }
    }

    changeSelectedEntityProperty2() {
        if (this.job.entityProperty2.length > 0) {
            const sp = this.job.entityProperty2.split(' . ');
            this.job.query2 = 'g.V().hasLabel(\'' + sp[0] + '\')';
            this.job.selectedProperty2 = sp[1];
        }
    }

    getGraphDBInstanceEndpointReference(endpoint) {
        for (const i in this.appStateService.graphDBInstances) {
            const instance = this.appStateService.graphDBInstances[i];
            if (instance['Endpoint'] == endpoint) {
                return instance['Endpoint'];
            }
        }
        return '';
    }

    getJobDefaults(): Job {
        const data: Job = {
            name: '',
            type: JobType.graphDBLoad,
            state: JobState.stopped,
            status: '',
            query1: '',
            query2: '',
            selectedQuery1: this.usePropertyQuery,
            selectedQuery2: this.usePropertyQuery,
            useHistory1: false,
            useHistory2: false,
            selectedProperty1: '',
            selectedProperty2: '',
            sourceInstance: this.getGraphDBInstanceEndpointReference(this.appStateService.account.graphDBEndpoint),
            destInstance: '',
            owner: '',
            algorithm: EntityResolutionAlgorithm.wratio,
            startThreadCount: 10,
            maxThreadCount: 100,
            threadLeadInTimeSeconds: 5,
            threshold: 90,
            addEdges: false,
            bidirectional: true,
            batchSize: 1000,
            computeClusterEndpoint: this.appStateService.account.appConfigs.appServices['api']['address'],
            entityProperty1: '',
            entityProperty2: '',
        };

        return data;
    }

    refresh(showMessage = true, force = false) {
        if (this.isRefreshing && !force) {

        } else {
            this.isRefreshing = true;
            this.appService.loadJobs(showMessage).then(() => {
                for (const jobIndex in this.appStateService.jobs) {
                    const job = this.appStateService.jobs[jobIndex];
                    if (this.jobDetailsName.length > 0 && job.name === this.jobDetailsName) {
                        this.details(job);
                        break;
                    }
                }
                this.isRefreshing = false;
            });
        }
    }

    loadJobViewer(jobObject: Job) {
        let job = {} as Job;
        MiscUtils.mergeDictionaries(jobObject, job);
        job = this.sanitizeJob(job);
        const x = $('#json-renderer-job');
        (x as any).jsonViewer(job, { rootCollapsable: false });
    }

    sanitizeJob(job: Job) {
        if (job.selectedQuery1 == null) {
        } else {
            if ('query' in job.selectedQuery1) {
                job.selectedQuery1 = job.selectedQuery1['query'];
            }
        }
        if (job.selectedQuery2 == null) {
        } else {
            if ('query' in job.selectedQuery2) {
                job.selectedQuery2 = job.selectedQuery2['query'];
            }
        }
        return job;
    }

    details(job: Job) {
        this.jobDetailsName = job.name;
        this.loadJobViewer(job);
    }

    edit(ejob: Job) {
        const job = {} as Job;
        MiscUtils.mergeDictionaries(ejob, job, true);
        this.job = job;
        for (const i in this.appStateService.savedQueries) {
            const q = this.appStateService.savedQueries[i];
            if (job.selectedQuery1 !== null) {
                if (q.queryName == job.selectedQuery1.queryName) {
                    this.job.selectedQuery1 = q;
                }
            }
            if (job.selectedQuery2 != null) {
                if (q.queryName == job.selectedQuery2.queryName) {
                    this.job.selectedQuery2 = q;
                }
            }
        }
        this.changeSelectedQuery1();
        this.changeSelectedQuery2();
    }

    async add() {
        if (this.appStateService.account.isAnonnymous) {
            this.showMessage('Please create profile', 'Please create a profile to create a job. Profiles do not require passwords and are used for tracking purposes only.');
        } else if (this.job.name == '') {
            this.showMessage('Please name your job', 'Please give your job a unique name.');
        } else {
            let add = true;
            for (const i in this.appStateService.jobs) {
                const job = this.appStateService.jobs[i];
                if (job.name == this.job.name) {
                    this.showMessage('Already Exists', 'That job name already exists.');
                    add = false;
                    break;
                }
            }
            if (add) {
                this.job.state = JobState.stopped;
                this.job.owner = '';
                this.job.status = '';

                this.save(this.job);
                this.details(this.job);
                this.job = this.getJobDefaults();
            }
        }
    }

    saveJob() {
        if (this.appStateService.account.isAnonnymous) {
            this.showMessage('Please create profile', 'Please create a profile to create a job. Profiles do not require passwords and are used for tracking purposes only.');
        } else if (this.job.name == '') {
            this.showMessage('Please name your job', 'Please give your job a unique name.');
        } else {
            let found = false;
            for (const i in this.appStateService.jobs) {
                const job = this.appStateService.jobs[i];
                if (job.name == this.job.name) {
                    found = true;
                    break;
                }
            }
            if (found) {
                this.save(this.job);
                this.details(this.job);
                this.job = this.getJobDefaults();
            } else {
                this.showMessage('Doesn\'t exist.', 'Job does not exist. Please add instead.');
            }
        }

    }

    save(job: Job) {
        const jobObj = {};
        MiscUtils.mergeDictionaries(job, jobObj);
        const data = { name: job.name, data: jobObj };
        this.appService.upsertJob(data).then(() => {
            this.refresh(false, true);
        });
    }

    stop(job: Job) {
        job.state = 'stopped' as JobState;
        job.status = 'Stopped.';
        job.owner = '';
        this.save(job);
    }

    start(job: Job) {
        job.state = 'started' as JobState;
        job.status = 'Started.';
        job.computeClusterEndpoint = this.appStateService.account.appConfigs.appServices['api']['address'];
        if ('statusHistory' in job) {
            (job as any)['statusHistory'] = [];
        }
        job.owner = '';
        this.save(job);
    }

    delete(job) {
        this.showMessage('Are you sure?', 'Are you sure you want to delete this job?', true, () => {
            this.appService.deleteJob(job).then(() => {
                this.refresh(false, true);
            });
        });
    }

    close() {
        JobsComponent.tryClose();
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

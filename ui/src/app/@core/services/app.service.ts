import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StatusService } from './status.service';
import { AppStateService } from './app.state.service';
import { MiscUtils } from '../utils/miscutils';
import { LoggerService } from './logger.service';
import { MQTTService } from './mqtt.service';
import { OboeService } from './oboe.service';

export interface APIResult {
    [x: string]: any;
}

export interface APIResponse {
    isSuccess: boolean;
    message: string;
    errorDetail: string;
    results: APIResult[];
}

export interface APIResponses {
    responses: APIResponse[];
}

@Injectable()
export class AppService {
    private initPromise: Promise<any> = null;

    constructor(private oboeService: OboeService, private loggerService: LoggerService, private appStateService: AppStateService, private http: HttpClient, private statusService: StatusService, private mqttService: MQTTService) {
    }

    public init(): Promise<any> {
        if (this.initPromise == null) {
            this.initPromise = new Promise<void>((resolve, reject) => {
                this.statusService.setStatus('Initializing app...').then((statusState) => {
                    this.loadAppConfigs().then(() => {
                        statusState.setCompleteStatus('Done initializing app.');
                        this.appStateService.isAppConfigsLoaded = true;
                        this.mqttService.attemptConnection();
                        resolve();
                    });
                });
            });
        }
        return this.initPromise;
    }

    public makeStreamingAPIGetCall(path: string, data: any = {}): Observable<APIResponse> {
        this.addUserIDToData(data);
        const apiAddress = this.getAPIAddress();
        const fullPath = apiAddress + path;
        return this.oboeService.get(fullPath, 'responses.*') as Observable<APIResponse>;
    }

    public makeStreamingAPIPOSTCall(path: string, data: any = {}): Observable<APIResponse> {
        this.addUserIDToData(data);
        const apiAddress = this.getAPIAddress();
        const fullPath = apiAddress + path;
        return this.oboeService.post(fullPath, 'responses.*', data) as Observable<APIResponse>;
    }

    public makeAPIPutCall(path: string, data: any = {}): Observable<APIResponses> {
        this.addUserIDToData(data);
        const apiAddress = this.getAPIAddress();
        const fullPath = apiAddress + path;
        return this.http.put<APIResponses>(fullPath, data);
    }

    public makeAPIPostCall(path: string, data: any = {}) {
        this.addUserIDToData(data);
        const apiAddress = this.getAPIAddress();
        const fullPath = apiAddress + path;
        return this.http.post(fullPath, data);
    }

    public makeStreamingJobsPostCall(path: string, data: any = {}): Observable<APIResponse> {
        this.addUserIDToData(data);
        const apiAddress = this.getAppJobsAddress();
        const fullPath = apiAddress + path;
        return this.oboeService.post(fullPath, 'responses.*', data) as Observable<APIResponse>;
    }

    public loadJobs(showMessage = true) {
        return new Promise<void>(async (resolve, reject) => {
            let statusState = null;
            if (showMessage) {
                statusState = await this.statusService.setStatus('Loading jobs...');
            }
            const data = { showMessage: showMessage };
            const jobs = [];
            this.makeStreamingJobsPostCall('/get-jobs', data).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                        const result = response.results[index];
                        const job = JSON.parse(result['data']);
                        job['name'] = result['name'];
                        jobs.push(job);
                    }
                } else {
                    if (showMessage) {
                        statusState.updateStatus('Error during job enumeration: ' + response.message);
                    }
                }
            }, (error) => {
                if (showMessage) {
                    statusState.setErrorStatus('Could not get jobs: ' + MiscUtils.getString(error));
                }
                resolve();
            }, () => {
                if (showMessage) {
                    statusState.setCompleteStatus('Finished getting jobs.');
                }
                this.appStateService.setJobs(jobs);
                resolve();
            });
        });
    }

    public upsertJob(data) {
        return new Promise<void>(async (resolve, reject) => {
            const statusState = await this.statusService.setStatus('Creating/updating job...');
            this.makeStreamingJobsPostCall('/upsert-job', data).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                    }
                } else {
                    statusState.updateStatus('Error during job creation/update: ' + response.message);
                }
            }, (error) => {
                statusState.setErrorStatus('Could not create/update job: ' + MiscUtils.getString(error));
                resolve();
            }, () => {
                statusState.setCompleteStatus('Finished creating/updating job.');
                resolve();
            });
        });
    }

    public deleteJob(data) {
        return new Promise<void>(async (resolve, reject) => {
            const statusState = await this.statusService.setStatus('Deleting job...');
            this.makeStreamingJobsPostCall('/delete-job', data).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                    }
                } else {
                    statusState.updateStatus('Error during job deletion: ' + response.message);
                }
            }, (error) => {
                statusState.setErrorStatus('Could not delete job: ' + MiscUtils.getString(error));
                resolve();
            }, () => {
                statusState.setCompleteStatus('Finished deleting job.');
                resolve();
            });
        });
    }

    public loadSavedQueries() {
        return new Promise<void>((resolve, reject) => {
            this.loggerService.log('Loading saved queries...');
            const savedQueries = [];
            return this.makeStreamingAPIPOSTCall('/graphdb-saved-queries', {}).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                        const result = response.results[index];
                        const queryObj = JSON.parse(result['query']);
                        savedQueries.push(queryObj);
                    }
                } else {
                    this.loggerService.log('Error loading queries: ' + response.message);
                }
            }, (error) => {
                this.loggerService.log('Error loading queries: ' + MiscUtils.getString(error));
                resolve();
            }, () => {
                this.appStateService.savedQueries = savedQueries;
                this.loggerService.log('Done loading saved queries.');
                resolve();
            });
        });
    }

    public loadGraphDBInstances(showMessage = true) {
        return new Promise<void>(async (resolve, reject) => {
            let statusState = null;
            if (showMessage) {
                statusState = await this.statusService.setStatus('Loading Graph DB instances...');
            }
            const data = { showMessage: showMessage };
            const instances = [];
            this.makeStreamingAPIPOSTCall('/get-graphdb-instances', data).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                        const result = response.results[index]['clusters'];
                        for (const ci in result) {
                            const instance = result[ci];
                            if ('Engine' in instance && 'Endpoint' in instance) {
                                instances.push(instance);
                            }
                        }
                    }
                    for (const index in response.results) {
                        const result = response.results[index]['instances'];
                        for (const i in result) {
                            const instance = result[i];
                            if ('Engine' in instance && 'DBClusterIdentifier' in instance) {
                                for (const ci in instances) {
                                    const cluster = instances[ci];
                                    if (cluster['Status'] == 'available' && cluster['DBClusterIdentifier'] == instance['DBClusterIdentifier'])  {
                                        cluster['Status'] = instance['DBInstanceStatus'];
                                    }
                                }
                            }
                        }
                    }
                } else {
                    if (showMessage) {
                        statusState.updateStatus('Error during instance enumeration: ' + response.message);
                    }
                }
            }, (error) => {
                if (showMessage) {
                    statusState.setErrorStatus('Could not get Graph DB instances: ' + MiscUtils.getString(error));
                }
                resolve();
            }, () => {
                if (showMessage) {
                    statusState.setCompleteStatus('Finished getting graph DB instances.');
                }
                this.appStateService.setGraphDBInstances(instances);
                resolve();
            });
        });
    }

    public createGraphDBCluster(data) {
        return new Promise<void>(async (resolve, reject) => {
            const statusState = await this.statusService.setStatus('Initiating the creation of Graph DB cluster...');
            this.makeStreamingAPIPOSTCall('/create-neptune-cluster', data).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                    }
                } else {
                    statusState.updateStatus('Error during cluster creation: ' + response.message);
                }
            }, (error) => {
                statusState.setErrorStatus('Could not create Graph DB cluster: ' + MiscUtils.getString(error));
                resolve();
            }, () => {
                statusState.setCompleteStatus('Finished initiating creation of Graph DB cluster.');
                resolve();
            });
        });
    }

    public createGraphDBInstance(data) {
        return new Promise<void>(async (resolve, reject) => {
            const statusState = await this.statusService.setStatus('Initiating the creation of Graph DB instance...');
            this.makeStreamingAPIPOSTCall('/create-neptune-instance', data).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                    }
                } else {
                    statusState.updateStatus('Error during instance creation: ' + response.message);
                }
            }, (error) => {
                statusState.setErrorStatus('Could not create Graph DB instance: ' + MiscUtils.getString(error));
                resolve();
            }, () => {
                statusState.setCompleteStatus('Finished initiating creation of Graph DB instance.');
                resolve();
            });
        });
    }

    public deleteGraphDBInstance(data) {
        return new Promise<void>(async (resolve, reject) => {
            const statusState = await this.statusService.setStatus('Initiating the deletion of Graph DB instance...');
            this.makeStreamingAPIPOSTCall('/delete-neptune-cluster', data).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                    }
                } else {
                    statusState.updateStatus('Error during instance deletion: ' + response.message);
                }
            }, (error) => {
                statusState.setErrorStatus('Could not delete Graph DB instance: ' + MiscUtils.getString(error));
                resolve();
            }, () => {
                statusState.setCompleteStatus('Finished initiating deletion of Graph DB instance.');
                resolve();
            });
        });
    }

    public async loadAppConfigs() {
        let statusState = await this.statusService.setStatus('Loading local app configs...');

        const appConfigs = {};
        try {
            const localConfigs = await this.http.get('assets/data/config-service-base-auto-generated.json').toPromise();
            MiscUtils.mergeDictionaries(localConfigs, appConfigs);
            await statusState.setCompleteStatus('Done loading local app configs.');
        } catch (e) {
            await statusState.setErrorStatus(e);
        }

        statusState = await this.statusService.setStatus('Loading API app configs...');

        try {
            const apiConfigs = await this.http.get('/appconfigs').toPromise();
            MiscUtils.mergeDictionaries(apiConfigs, appConfigs);
            await statusState.setCompleteStatus('Done loading API app configs.');
        } catch (e) {
            await statusState.setErrorStatus('Could not load API configs.');
        }

        this.appStateService.setOriginalAppConfigs(appConfigs);
        this.appStateService.setAppConfigs(appConfigs);

        this.setWindowTitleToAppName();

        return appConfigs;
    }

    public setWindowTitleToAppName() {
        document.title = this.appStateService.appConfigs["appName"].toUpperCase();
    }

    public getAPIAddress() {
        const apiAddress = 'http://' + MiscUtils.getAddress(this.appStateService.appConfigs.appServices['api'].address) + ':' + this.appStateService.appConfigs.appServices['api'].port.toString();
        return apiAddress;
    }

    public getAppJobsAddress() {
        const apiAddress = 'http://' + MiscUtils.getAddress(this.appStateService.appConfigs.appServices['api'].address) + ':' + this.appStateService.appConfigs.appServices['api'].port.toString();
        return apiAddress;
    }

    private addUserIDToData(data: any = null) {
        if (data == null) {

        } else {
            if (typeof data === 'object') {
                data['userID'] = this.appStateService.getUserID();
            }
        }
    }
}

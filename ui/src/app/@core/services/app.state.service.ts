import { Injectable } from '@angular/core';
import { MiscUtils } from '../utils/miscutils';
import { AppAccount } from '../services/app.account.service';
import { NAMED_ENTITIES } from '@angular/compiler';

export interface AppConfigurations {
    'appOrganization': string;
    'appName': string;
    'branch': string;
    'thisService': string;
    'appServices'?: {
        'ui': {
            'address': string,
            'port': number,
            'footerText': string
        },
        'api': {
            'address': string,
            'port': number,
            'graphDB': {
                'endpoint': string,
            },
        },
    };
}

export enum EntityResolutionAlgorithm {
    exactStringMatch = 'exactMatch',
    wratio = 'wratio',
    caseInsensitiveMatch = 'caseInsensitiveMatch',
    geoNames = 'geoNames',
}

export enum JobType {
    graphDBLoad = 'graphDBLoad',
    entityResolution = 'entityResolution',
}

export enum JobState {
    stopped = 'stopped',
    started = 'started',
}

export interface Job {
    name: string;
    type: JobType;
    state: JobState;
    status: string;
    query1: string;
    query2: string;
    selectedQuery1: any;
    selectedQuery2: any;
    useHistory1: boolean;
    useHistory2: boolean;
    selectedProperty1: string;
    selectedProperty2: string;
    sourceInstance: string;
    destInstance: string;
    owner: string;
    algorithm: EntityResolutionAlgorithm;
    startThreadCount: number;
    maxThreadCount: number;
    threadLeadInTimeSeconds: number;
    threshold: number;
    addEdges: boolean;
    bidirectional: boolean;
    batchSize: number;
    computeClusterEndpoint: string;
    entityProperty1: string;
    entityProperty2: string;
}

@Injectable()
export class AppStateService {
    private initPromise: Promise<any> = null;
    private initializedResolver: any = null;

    public thisInstanceID = MiscUtils.getUUID();
    public isAppConfigsLoaded: boolean = false;
    public savedQueries: any[] = [];
    public allAccounts: AppAccount[] = [];
    public account: AppAccount = null;
    public graphDBInstances: any[] = [];
    public jobs: Job[] = [];

    private originalAppConfigs: AppConfigurations = null;
    public appConfigs: AppConfigurations = null;

    constructor() {
        this.originalAppConfigs = this.getDefaultAppConfigs();
        this.appConfigs = this.getDefaultAppConfigs();
        this.init();
    }

    public init() {
        if (!this.initPromise) {
            this.initPromise = new Promise((resolve, reject) => {
                this.initializedResolver = resolve;
            });
        }
        return this.initPromise;
    }

    public resolveInitialized() {
        if (this.initializedResolver) {
            this.initializedResolver();
        } else {
            console.log('ERROR: Could not resolve app initialization.');
        }
    }

    public getOriginalAppConfigs() {
        const configs = {};
        if (this.originalAppConfigs != null) {
            MiscUtils.mergeDictionaries(this.originalAppConfigs, configs);
        }
        return configs;
    }

    public setAppConfigs(configs) {
        MiscUtils.mergeDictionaries(configs, this.appConfigs);
    }

    public setOriginalAppConfigs(configs) {
        MiscUtils.mergeDictionaries(configs, this.originalAppConfigs);
    }

    public setGraphDBInstances(instances) {
        this.graphDBInstances = [];
        for (const index in instances) {
            const instance = instances[index];
            this.graphDBInstances.push(instance);
        }
    }

    public setJobs(jobs: any[]) {
        this.jobs = jobs as Job[];
    }

    public getUserID() {
        if (this.account == null) {
            return this.thisInstanceID;
        } else {
            if (this.account.isAnonymous) {
                return this.thisInstanceID;
            } else {
                //return this.account.name;
                return this.thisInstanceID;
            }
        }
    }

    public getCompleteAppName() {
        return this.appConfigs['appOrganization'] + '-' + this.appConfigs['appName'] + '-' + this.appConfigs['branch'];
    }

    public getCompleteServiceName(serviceName:string = null) {
        const appName = this.getCompleteAppName();
        var sName = serviceName;
        if (sName == null) {
            sName = this.appConfigs['thisService'];
        }
        return appName + "-" + sName;
    }

    public getCompleteAppID() {
        return this.getCompleteServiceName() + '-' + this.getUserID();
    }

    public getEndpointShortName(endpoint: string) {
        let name = endpoint;
        if (MiscUtils.validateIPaddress(endpoint)) {
            name = endpoint;
        } else {
            if (name.includes('.')) {
                name = endpoint.split('.')[0];
            }
        }

        if (name.indexOf(this.getCompleteAppName()) == 0) {
            let replaceword = '';
            const sp = name.split('-');
            replaceword = sp[sp.length - 1];
            name = name.replace('-' + replaceword, '');
        } else {
            name = name.replace('-' + this.getCompleteAppName(), '');
        }

        return name;
    }

    public getAppTopicForService(serviceName:string = ''):string {
        const appOrg = this.appConfigs['appOrganization'];
        const appName = this.appConfigs['appName'];
        const branch = this.appConfigs['branch'];

        const topic = this.generateTopic([appOrg, appName, branch, serviceName.replace('-', '/')]);
        return topic;
    }

    public getAppTopicUI(topic: string = ''): string {
        const appOrg = this.appConfigs['appOrganization'];
        const appName = this.appConfigs['appName'];
        const branch = this.appConfigs['branch'];
        const serviceName = this.appConfigs['thisService'];
        
        const prefix = this.getAppTopicForService(serviceName);

        let fullTopic = '';
        if (topic.length > 0) {
            fullTopic = prefix + '/' + topic;
        } else {
            fullTopic = prefix;
        }
        return fullTopic;
    }

    public getAppTopicAPI(topic: string = ''): string {
        const appOrg = this.appConfigs['appOrganization'];
        const appName = this.appConfigs['appName'];
        const branch = this.appConfigs['branch'];
        const serviceName = 'api';
        
        const prefix = this.getAppTopicForService(serviceName);

        let fullTopic = '';
        if (topic.length > 0) {
            fullTopic = prefix + '/' + topic;
        } else {
            fullTopic = prefix;
        }
        return fullTopic;
    }

    public getAppTopicUIForThisUser() {
        return this.getAppTopicUI(this.getUserID());
    }

    public getAppTopicAPIForThisUser() {
        return this.getAppTopicAPI("+/+/" +this.getUserID());
    }
    
    public generateTopic(names: string[]): string {
        let topicName = '';
        for (let index = 0; index < names.length; index++) {
            const name = names[index];
            if (typeof(name) != 'undefined') {
                if (name.length > 0) {
                    topicName = (topicName.length > 0 ? topicName + '/' + name : name);
                }
            }
        }
        return topicName;
    }

    public getDefaultAppConfigs(): AppConfigurations {
        const newConfigs = {};
        const appConfigs: AppConfigurations = {
            'appOrganization': 'inv',
            'appName': 'gda',
            'branch': 'dev',
            'thisService': 'ui',
            'appServices': {
                'ui': {
                    'address': '',
                    'port': 0,
                    'footerText': "<b>Created by</b>: Timothy Toohill <a href='https://github.com/timothytoohill' target='_blank'><i class='ion ion-social-github' style='font-size:30px'></i></a>"
                },
                'api': {
                    'address': '',
                    'port': 18080,
                    'graphDB': {
                        'endpoint': 'localhost:8182',
                    },
                },
            },
        };
        MiscUtils.mergeDictionaries(appConfigs, newConfigs);
        MiscUtils.mergeDictionaries(this.getOriginalAppConfigs(), newConfigs);
        return newConfigs as AppConfigurations;
    }
}

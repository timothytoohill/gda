import { Injectable } from '@angular/core';
import { StatusService } from './status.service';
import { AppService } from './app.service';
import { AppStateService } from './app.state.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MiscUtils } from '../utils/miscutils';
import { LoggerService } from './logger.service';
import { MQTTService } from './mqtt.service';
import { timer, BehaviorSubject } from 'rxjs';
import { stat } from 'fs';

export interface Queue {
    queue_name: string;
}

@Injectable()
export class QueuesService {
    public queues = new BehaviorSubject<Queue[]>([]);
    public queueCount: number = 0;

    private isLoadingQueues: boolean = false;
    private updateTimer = timer(0, 10000);
    private autoUpdate: boolean = false;

    constructor(private appService: AppService, private loggerService: LoggerService, private appStateService: AppStateService, private http: HttpClient, private statusService: StatusService, private mqttService: MQTTService) {
        if (this.autoUpdate) {
            this.updateTimer.subscribe(() => {
                this.updateThread();
            });
        }
        this.loadQueues();
    }

    private updateThread() {
        if (this.queues.observers.length > 0) {
            this.loadQueues();
        }
    }

    public async addQueue(queueName: string) {
        const statusState = await this.statusService.setStatus('Adding new queue \'' + queueName + '\'.');
        try {
            const data = { queue_name: queueName } as Queue;
            await this.appService.makeStreamingAPIGetCall('/add-queue', data);
            await statusState.setCompleteStatus('Added queue ' + queueName + '.');
        } catch (e) {
            await statusState.setErrorStatus(e);
        }
    }

    public async loadQueues() {
        if (!this.isLoadingQueues) {
            this.isLoadingQueues = true;
            const statusState = await this.statusService.setStatus('Refreshing queue list...');

            try {
                const statusState2 = await this.statusService.setStatus('Updating queue count...');
                this.appService.makeStreamingAPIGetCall('/get-queue-count').subscribe(
                    async (result) => {
                        console.log(result);
                        if (result.isSuccess) {
                            this.queueCount = result.results[0].count;
                        } else {
                            await statusState2.setErrorStatus(result.message);
                        }
                    },
                    async (err) => {
                        await statusState2.setErrorStatus(err);
                    },
                    async () => {
                        await statusState2.setCompleteStatus('Done updating queue count: ' + this.queueCount.toString() + '.');
                        const queues = [];
                        const statusState3 = await this.statusService.setStatus('Downloading queue list...');
                        const totalDownloaded = 0;
                        this.appService.makeStreamingAPIGetCall('/get-queues').subscribe(
                            async (result) => {
                                console.log(result);
                                // totalDownloaded += result.
                                statusState3.updateStatus('Downloading ');
                            },
                            async (err) => {
                                await statusState3.setErrorStatus(err);
                            },
                            async () => {
                                statusState3.setCompleteStatus();
                                statusState.setCompleteStatus();
                            },
                        );
                    },
                );
            } catch (e) {
                await statusState.setErrorStatus(e);
            }
        }
        this.isLoadingQueues = false;
    }
}

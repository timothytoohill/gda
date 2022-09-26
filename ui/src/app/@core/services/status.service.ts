import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { LoggerService } from './logger.service';
import { MiscUtils } from '../utils/miscutils';

@Injectable()
export class StatusService {
    public status: string = '';
    public currentDateTime: string = '';
    public isReady: boolean = true;

    private updateTimer = timer(0, 1300);
    private statusStates: StatusState[] = [];
    private statusIndex: number = 0;
    private readyStates: string[] = ['Ready.']; // ["Ready. Bring it.", "Ready.", "Ready. Born ready.", "Ready. Always.", "Ready.", "Ready."]
    private updateStatusStates: boolean = false;
    private currentStatusState: StatusState = null;
    private skipNextUpdate = false;

    constructor(private loggerService: LoggerService) {
        this.updateTimer.subscribe((count) => {
            this.updateCurrentTime();
            if (this.updateStatusStates && !this.skipNextUpdate) {
                this.clearCompletedStatuses();
                this.setNextStatus();
            }
            this.skipNextUpdate = false;
        });
    }

    public async setStatus(status: string, useLoggerService: boolean = true): Promise<StatusState> {
        const newStatusState = new StatusState(status, this, useLoggerService);
        this.statusStates.push(newStatusState);
        this.setStatusFromStatusState(newStatusState);
        this.updateStatusStates = true;
        this.setIsReady(false);
        return newStatusState;
    }

    public updateStatus(statusState: StatusState) {
        this.skipNextUpdate = true;
        this.setStatusFromStatusState(statusState);
        return statusState;
    }

    private updateCurrentTime() {
        const today = new Date();
        const date = today.getFullYear().toString().padStart(4, '0') + '-' + (today.getMonth() + 1).toString().padStart(2, '0') + '-' + today.getDate().toString().padStart(2, '0');
        const time = today.getHours().toString().padStart(2, '0') + ':' + today.getMinutes().toString().padStart(2, '0') + ':' + today.getSeconds().toString().padStart(2, '0');        const dateTime = date + ' ' + time;
        this.currentDateTime = dateTime;
    }

    private clearCompletedStatuses() {
        const newStatusStates = [];

        for (let index = 0; index < this.statusStates.length; index++) {
            const statusState = this.statusStates[index];
            if (statusState.getIsComplete()) {
                if (index < this.statusIndex) {
                    this.statusIndex--;
                }
            } else {
                newStatusStates.push(statusState);
            }
        }

        this.statusStates = newStatusStates;
    }

    private setStatusFromStatusState(statusState: StatusState) {
        const status = statusState.getStatusStr();
        this.status = status;
        this.currentStatusState = statusState;
        if (statusState.useLoggerService && !statusState.usedLoggerService) {
            this.loggerService.log(status, 'status');
            statusState.usedLoggerService = true;
        }
    }

    private setNextStatus() {
        if (this.statusStates.length > 0) {
            this.statusIndex++;

            if (this.statusIndex >= this.statusStates.length) {
                this.statusIndex = 0;
            }

            const nextStatus = this.statusStates[this.statusIndex];
            if (!Object.is(this.currentStatusState, nextStatus)) {
                this.setStatusFromStatusState(this.statusStates[this.statusIndex]);
            }
        } else {
            this.setIsReady(true);
        }
    }

    private setIsReady(isReady: boolean = true) {
        this.isReady = isReady;
        if (isReady) {
            this.status = this.getRandomReadyState();
            this.updateStatusStates = false;
        }
    }

    private getRandomReadyState(): string {
        const index: number = Math.floor((Math.random() * this.readyStates.length));
        const ready = this.readyStates[index];
        return ready;
    }
}

export class StatusState {
    private statusStr: string = '';
    private isComplete: boolean = false;
    private isError: boolean = false;
    private errorStr: string = '';
    public usedLoggerService: boolean = false;

    constructor(status: string = '', private statusService: StatusService, public useLoggerService: boolean) {
        this.statusStr = status;
    }

    public async setCompleteStatus(message: any = null, isComplete: boolean = true, createSuccessStatus: boolean = true) {
        this.isComplete = isComplete;
        if (isComplete && createSuccessStatus) {
            const mess = MiscUtils.getStatusString(message);
            let successMessage = mess;
            if (successMessage == null) {
                successMessage = '(SUCCESS) ' + this.statusStr;
            }
            const statusState = await this.statusService.setStatus(successMessage, this.useLoggerService);
            statusState.setCompleteStatus(null, true, false);
        }
    }

    public async setErrorStatus(message: any = null, isError: boolean = true, createErrorStatus: boolean = true) {
        this.isError = isError;
        this.isComplete = true;
        if (isError && createErrorStatus) {
            const mess = MiscUtils.getStatusString(message);
            let errorMessage = mess;
            if (errorMessage == null) {
                errorMessage = '(ERROR) ' + this.statusStr;
            }
            const statusState = await this.statusService.setStatus(errorMessage, this.useLoggerService);
            statusState.setCompleteStatus(null, true, false);
        }
    }

    public async updateStatus(message: any = null) {
        const mess = MiscUtils.getStatusString(message);
        this.statusStr = mess;
        this.statusService.updateStatus(this);
    }

    public getStatusStr(): string {
        return this.statusStr;
    }

    public getIsComplete(): boolean {
        return this.isComplete;
    }

    public getErrorStr(): string {
        return this.errorStr;
    }

    public getIsError(): boolean {
        return this.isError;
    }
}

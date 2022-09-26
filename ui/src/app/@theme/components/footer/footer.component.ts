import { Component, DoCheck, OnDestroy } from '@angular/core';
import { StatusService } from '../../../@core/services/status.service';
import { AppStateService } from '../../../@core/services/app.state.service';
import { timer, Subscription } from 'rxjs';

@Component({
    selector: 'ngx-footer',
    styleUrls: ['./footer.component.scss'],
    templateUrl: './footer.component.html',
})
export class FooterComponent implements DoCheck, OnDestroy {
    public showStatus: boolean = true;
    public isBusy: boolean = false;

    private blinkDelay = 500;
    private blinkRate = 100;
    private blinkTimer = timer(0, this.blinkRate);
    private readyTimer = timer(0, 100);
    private blinkSubscription: Subscription = null;
    private readySubscription: Subscription = null;
    private lastReady: number = 0;
    private wasReady: boolean = true;
    private shouldBlink: boolean = true;

    constructor(public statusService: StatusService, public appStateService: AppStateService) {
    }

    ngOnDestroy() {
        this.resetBlinker();
    }

    ngDoCheck() {
        if (this.statusService.isReady) {
            if (this.shouldBlink) {
                if (this.wasReady) {
                } else {
                    this.lastReady = Date.now();
                    this.blinkSubscription = this.blinkTimer.subscribe(() => {
                        this.showStatus = !this.showStatus;
                    });
                    this.readySubscription = this.readyTimer.subscribe(() => {
                        const nowDT = Date.now();
                        if ((nowDT - this.lastReady) > this.blinkDelay) {
                            this.resetBlinker();
                            this.showStatus = true;
                            this.lastReady = 0;
                            this.isBusy = false;
                        }
                    });
                }
                this.wasReady = true;
            } else {
                this.isBusy = false;
                this.wasReady = true;
            }
        } else {
            this.resetBlinker();
            this.isBusy = true;
            this.wasReady = false;
        }
    }

    private resetBlinker() {
        if (this.readySubscription) {
            this.readySubscription.unsubscribe();
            this.readySubscription = null;
        }
        if (this.blinkSubscription) {
            this.blinkSubscription.unsubscribe();
            this.blinkSubscription = null;
        }
    }

    public getFooterText() {
        return this.appStateService.appConfigs["appServices"]["ui"]["footerText"];
    }
}

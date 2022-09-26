import { Component, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { timer } from 'rxjs';
import { MQTTLogsComponent } from '../../../../@core/components/mqtt/logs/mqtt.logs.component';
import { AppStateService } from '../../../../@core/services/app.state.service';

@Component({ selector: 'system-logs-mqtt-both', templateUrl: 'both.component.html', styleUrls: ['both.component.scss'] })
export class SystemLogsMQTTBothComponent implements AfterViewInit {
    private dashboardTopics = [];
    @ViewChild('mqLogs', { static: false }) private mqLogs: MQTTLogsComponent;

    constructor(public appStateService:AppStateService) {
        
    }

    ngAfterViewInit() {
        timer(1000).subscribe(() => {
            this.dashboardTopics = [this.appStateService.appConfigs['appOrganization'] + "/#"];
            this.mqLogs.subscribeToTopics(this.dashboardTopics);
        });
    }
}

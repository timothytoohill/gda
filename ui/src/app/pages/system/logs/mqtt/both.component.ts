import { Component, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { timer } from 'rxjs';
import { MQTTLogsComponent } from '../../../../@core/components/mqtt/logs/mqtt.logs.component';

@Component({ selector: 'system-logs-mqtt-both', templateUrl: 'both.component.html', styleUrls: ['both.component.scss'] })
export class SystemLogsMQTTBothComponent implements AfterViewInit {
    private dashboardTopics = [];
    @ViewChild('mqLogs', { static: false }) private mqLogs: MQTTLogsComponent;

    ngAfterViewInit() {
        timer(1000).subscribe(() => {
            this.dashboardTopics = ['inv/#'];
            this.mqLogs.subscribeToTopics(this.dashboardTopics);
        });
    }
}

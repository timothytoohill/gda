import { Component, ElementRef } from '@angular/core';
import { StatusService } from '../../../../@core/services/status.service';
import { MQTTService, MQTTPayload } from '../../../../@core/services/mqtt.service';

@Component({ selector: 'system-logs-mqtt-logs', templateUrl: 'logs.component.html', styleUrls: ['both.component.scss'] })
export class SystemLogsMQTTLogsComponent {
}

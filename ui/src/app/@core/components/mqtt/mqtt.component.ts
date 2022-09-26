import { Component, OnDestroy, OnInit } from '@angular/core';
import { MQTTService, MQTTSubscription, MQTTSubscriptionCallback, MQTTPayload } from '../../services/mqtt.service';
import { StatusService } from '../../services/status.service';

@Component({ selector: 'mqtt', template: '<router-outlet></router-outlet>' })
export class MQTTComponent implements OnDestroy, OnInit {
    private subscriptions: any = {};

    constructor(public mqttService: MQTTService, public statusService: StatusService) { }

    mqttSubscribe(topic: string, callback: MQTTSubscriptionCallback) {
        this.statusService.setStatus('Subscribing to topic \'' + topic + '\'...').then(statusState => {
            const subscription = this.mqttService.subscribe(topic, callback);
            this.subscriptions[subscription.id] = subscription;
            statusState.setCompleteStatus('Successfully subscribed to topic \'' + topic + '\'.');
        });
    }

    mqttUnsubscribe(subscription: MQTTSubscription) {
        if (subscription.id in this.subscriptions) {
            const status = this.statusService.setStatus('Unsubscribing from \'' + subscription.topic + '\'...');
            this.mqttService.unsubscribe(subscription);
            delete this.subscriptions[subscription.id];
            status.then((statusState) => {
                statusState.setCompleteStatus('Successfully unsubscribed from \'' + subscription.topic + '\'.');
            });
        }
    }

    mqttUnsubscribeAll() {
        const keys = Object.keys(this.subscriptions);
        for (const index in keys) {
            this.mqttUnsubscribe(this.subscriptions[keys[index]]);
        }
    }

    mqttPublish(topic: string, message: string) {
        this.mqttService.publish(topic, message);
    }

    ngOnInit() {
    }

    ngOnDestroy() {
        this.mqttUnsubscribeAll();
    }
}

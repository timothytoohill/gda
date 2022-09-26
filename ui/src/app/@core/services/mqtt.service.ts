import { Injectable } from '@angular/core';
import { AppStateService } from './app.state.service';
import { MiscUtils } from '../utils/miscutils';
import { timer } from 'rxjs';

declare var mqtt: any;

export interface MQTTPayload {
    dateTime: string;
    message: string;
    [x: string]: any;
}

export type MQTTSubscriptionCallback = (topic: string, payload: MQTTPayload) => void;

@Injectable()
export class MQTTService {
    private mqtt: MQTT = new MQTT();
    private mqttAddress: string = '';
    private attemptConnectTimer = timer(0, 10000);

    constructor(private appStateService: AppStateService) {
        this.mqtt.setClientID(appStateService.getCompleteAppID() + "-browser");
        this.attemptConnectTimer.subscribe(() => {
            if (document.hasFocus()) {
                this.attemptConnection();
            }
        });
        addEventListener('focus', (event) => { 
            this.attemptConnection();
        });
    }

    public publish(topic: string, message: string) {
        if (this.checkConnection()) {
            this.mqtt.publish(topic, message);
        } else {
            // console.debug("MQ not connected. Can't publish.");
        }
    }

    public subscribe(topic: string, callback: MQTTSubscriptionCallback): MQTTSubscription {
        return this.mqtt.subscribe(topic, callback);
    }

    public unsubscribe(subscription: MQTTSubscription) {
        if (this.mqtt != null) {
            this.mqtt.unsubscribe(subscription);
        }
    }

    public attemptConnection(): boolean {
        if (this.checkConnection()) {
        } else {
            if (this.appStateService.isAppConfigsLoaded) {
                if (typeof(this.appStateService.appConfigs['appServices']['ui']['mq']) == 'undefined') {
                    console.debug('MQ cannot connect. Cannot get state service values.');
                    return false;
                } else {
                    this.mqttAddress = 'ws://' + MiscUtils.getAddress(this.appStateService.appConfigs['appServices']['ui']['mq']['address']) + ':' + this.appStateService.appConfigs['appServices']['ui']['mq']['wsport'].toString();
                    this.mqtt.address = this.mqttAddress;
                    this.mqtt.username = this.appStateService.appConfigs['appServices']['ui']['mq']['username'];
                    this.mqtt.password = this.appStateService.appConfigs['appServices']['ui']['mq']['password'];
                    this.mqtt.connect();
                }
            }
        }
        return true;
    }

    public closeConnection() {
        if (this.mqtt == null) return;
        this.mqtt.close();
    }

    private checkConnection(): boolean {
        if (this.mqtt == null) return false;
        return this.mqtt.isConnected() || this.mqtt.isConnecting();
    }
}

export class MQTT {
    public address: string = 'mqtt://localhost:1883';
    public username: string = null;
    public password: string = null;
    public clientID: string = null;

    private client: any = null;
    private connecting = false;
    private connected: boolean = false;
    private subscriptions: MQTTSubscriptions = {};

    private lastReceivedMessageTime: number = 0;

    private bufferMessages: boolean = true;
    private bufferSendTimerDelay = 100;
    private bufferSize: number = 1000;
    private bufferSendTimer = null;

    private patternMatches: any = {};

    constructor(address: string = '') {
        this.address = address;
        if (this.bufferMessages) {
            this.bufferSendTimer = timer(0, this.bufferSendTimerDelay);
            this.bufferSendTimer.subscribe(() => {
                this.sendAllBufferedMessages();
            });
        }
    }

    public setClientID(id:string) {
        this.clientID = id;
    }

    public isConnecting() {
        return this.connecting;
    }

    public isConnected() {
        return this.connected;
    }

    public publish(topic: string, message: string) {
        if (this.client == null) {
            // skip
        } else {
            if (this.connected) {
                const nowDT = new Date();
                const payload = { dateTime: nowDT.toISOString(), message: message } as MQTTPayload;
                this.client.publish(topic, JSON.stringify(payload));
            }
        }
    }

    public subscribe(topic: string, callback: MQTTSubscriptionCallback): MQTTSubscription {
        const newSub = new MQTTSubscription(topic, callback);
        this.subscriptions[newSub.id] = newSub;
        this.applySubscription(newSub);
        return newSub;
    }

    public unsubscribe(subscription: MQTTSubscription) {
        if (subscription.id in this.subscriptions) {
            delete this.subscriptions[subscription.id];

            const otherHasSameTopicAndIsSubscribed = this.doesAnotherSubscriptionHaveSameTopicAndIsSubscribed(subscription);
            if (otherHasSameTopicAndIsSubscribed) {

            } else {
                if (this.connected) {
                    if (subscription.isSubscribed) {
                        this.client.unsubscribe(subscription.topic, {}, (err, granted) => {
                            if (err == null) {
                            } else {
                                console.debug('Error unsubscribing topic:', err);
                            }
                        });
                    }
                }
            }
        }
    }

    public connect(address: string = this.address, username: string = this.username, password: string = this.password, autoReconnect: boolean = false) {
        this.connecting = true;
        this.address = address;
        const options: any = {};

        options['reconnectPeriod'] = 0;
        options['keepalive'] = 5;
        
        if (this.clientID == null) {

        } else {
            options['clientId'] = this.clientID;
        }

        if (username) {
            options['username'] = username;
        }
        if (password) {
            options['password'] = password;
        }

        console.debug("Connecting MQTT client...");
        this.client = mqtt.connect(address, options);

        this.client.on('connect', () => { this.onConnect(); });
        this.client.on('close', () => { this.onClose(); } );
        this.client.on('disconnect', () => { this.onDisconnect(); });
        this.client.on('offline', () => { this.onOffline(); });
        this.client.on('error', (error) => { this.onError(error); });
        this.client.on('reconnect', () => { this.onReconnect(); });

        this.client.on('message', (topic, payload) => { this.onMessage(topic, payload); });

        if (autoReconnect) {
        } else {
            this.client.stream.on('error', (error) => { this.onStreamError(error); });
        }
    }

    public close() {
        if (this.client != null) {
            console.debug('Closing MQ connection...');
            try {
                this.client.end();
            } catch (e) {}
            try {
                this.client.stream.end();
            } catch (e) {}
            this.client = null;
            console.debug('MQ connection is closed.');
        }
        this.connecting = false;
        this.connected = false;
    }

    private resetExistingSubscriptions() {
        const existingSubscriptions = this.subscriptions;

        for (const key in existingSubscriptions) {
            const sub = existingSubscriptions[key];
            sub.isSubscribed = false;
        }

        for (const key in existingSubscriptions) {
            const sub = existingSubscriptions[key];
            this.applySubscription(sub);
        }
    }

    private applySubscription(sub: MQTTSubscription) {
        const otherHasSameTopicAndIsSubscribed = this.doesAnotherSubscriptionHaveSameTopicAndIsSubscribed(sub);

        if (otherHasSameTopicAndIsSubscribed) {
            sub.isSubscribed = true;
        } else {
            if (this.connected) {
                this.client.subscribe(sub.topic);
                sub.isSubscribed = true;
            }
        }
    }

    private doesAnotherSubscriptionHaveSameTopicAndIsSubscribed(sub: MQTTSubscription) {
        let otherHasSameTopicAndIsSubscribed = false;
        for (const key in this.subscriptions) {
            const existingSub = this.subscriptions[key];
            if (sub.id === existingSub.id) {

            } else {
                if (existingSub.topic == sub.topic) {
                    if (existingSub.isSubscribed) {
                        otherHasSameTopicAndIsSubscribed = true;
                        break;
                    }
                }
            }
        }
        return otherHasSameTopicAndIsSubscribed;
    }

    private onMessage(topic: string, payload: any) {
        const nowDT = Date.now();

        for (const key in this.subscriptions) {
            const sub = this.subscriptions[key];

            const makeTheCall = this.doesTopicMatchPattern(topic, sub.topic);

            if (makeTheCall) {
                const pl = this.buildPayload(payload);

                if ((nowDT - this.lastReceivedMessageTime > this.bufferSendTimerDelay) || (!this.bufferMessages)) {
                    if (this.bufferMessages) {
                        this.sendBufferedMessages(sub);
                    }
                    sub.callback(topic, pl);
                } else {
                    if (!(topic in sub.buffer)) {
                        sub.buffer[topic] = [];
                    }
                    if (sub.buffer[topic].length > this.bufferSize) {
                        console.debug('MQ buffer size exceeded. Proceeding, but this could be a problem.');
                    }
                    sub.buffer[topic].push(pl);
                }
            }
        }

        this.lastReceivedMessageTime = Date.now();
    }

    private sendAllBufferedMessages() {
        for (const id in this.subscriptions) {
            this.sendBufferedMessages(this.subscriptions[id]);
        }
    }

    private sendBufferedMessages(sub: MQTTSubscription) {
        for (const topic in sub.buffer) {
            while (sub.buffer[topic].length > 0) {
                sub.callback(topic, sub.buffer[topic].shift());
            }
        }
    }

    private doesTopicMatchPattern(topic: string, pattern: string): boolean {
        if (topic === pattern)
            return true;

        if (pattern in this.patternMatches) {
            if (topic in this.patternMatches[pattern].matched)
                return true;
            if (topic in this.patternMatches[pattern].notMatched)
                return false;
        } else {
            this.patternMatches[pattern] = {};
            this.patternMatches[pattern]['matched'] = {};
            this.patternMatches[pattern]['notMatched'] = {};
        }

        const ruledTopic = pattern.replace(/#/g, '*').replace(/\+/g, '*'); // THIS MAY NOT MATCH PERFECTLY WITH THE WAY MQTT MATCHES. TESTING REQUIRED!

        if (MiscUtils.matchRule(topic, ruledTopic)) {
            this.patternMatches[pattern]['matched'][topic] = null;
            return true;
        } else {
            this.patternMatches[pattern]['notMatched'][topic] = null;
        }

        return false;
    }

    private buildPayload(payload: any): MQTTPayload {
        let pl = {};
        try {
            pl = JSON.parse(payload) as MQTTPayload;
        } catch (e) {
        }

        if (!('dateTime' in pl && 'message' in pl)) {
            const nowDT = new Date();
            pl['dateTime'] = nowDT.toISOString();
            pl['message'] = payload.toString();
        }

        return pl as MQTTPayload;
    }

    private onStreamError(error) {
        console.debug('Stream error:', error);
        this.close();
    }

    private onConnect() {
        this.connecting = false;
        this.connected = true;
        console.debug('MQ client connected to ' + this.address);
        if (Object.keys(this.subscriptions).length > 0) {
            timer(100).subscribe(() => {
                console.debug('Resetting existing MQ subscriptions...');
                this.resetExistingSubscriptions();
                console.debug('Done resetting existing MQ subscriptions.');
            });
        }
    }

    private onDisconnect() {
        console.debug('MQ disconnected from ' + this.address + '.' );
        this.close();
    }

    private onClose() {
        console.debug('MQ closed ' + this.address + '.' );
        this.close(); 
    }

    private onOffline() {
        console.debug('MQ offline ' + this.address + '.' );
        this.close();
    }

    private onError(error) {
        console.debug('MQ error: ' + error);
    }

    private onReconnect() {
        console.debug('MQ reconnect ' + this.address + '...' );
    }
}

export interface MQTTSubscriptions {
    [key: string]: MQTTSubscription;
}

export interface MQTTSubscriptionBuffer {
    [topic: string]: MQTTPayload[];
}

export class MQTTSubscription {
    public id: string = MiscUtils.getUUID();
    public topic: string = '';
    public isSubscribed: boolean = false;
    public callback: MQTTSubscriptionCallback;
    public buffer: MQTTSubscriptionBuffer = {};

    constructor(topic: string, callback: MQTTSubscriptionCallback) {
        this.topic = topic;
        this.callback = callback;
    }
}


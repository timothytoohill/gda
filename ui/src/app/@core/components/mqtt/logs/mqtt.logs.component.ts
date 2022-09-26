import { Component, ElementRef, Input, ViewChild, AfterViewChecked, OnChanges, SimpleChanges, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { StatusService } from '../../../services/status.service';
import { AppStateService } from '../../../services/app.state.service';
import { MQTTService, MQTTPayload } from '../../../services/mqtt.service';
import { MQTTComponent } from '../mqtt.component';
import { timer, Subscription } from 'rxjs';
import { ScrollableContainerComponent } from '../../scrollable-container/scrollable.container.component';

@Component({ selector: 'mqtt-logs', templateUrl: 'mqtt.logs.component.html', styleUrls: ['mqtt.logs.component.scss'] })
export class MQTTLogsComponent extends MQTTComponent implements AfterViewChecked, OnChanges, OnInit, AfterViewInit, OnDestroy {
    public logs: any[] = [];
    public topics: string[] = ['inv/#'];
    public stripTopics: string[] = [];
    public replaceTopics: string[][] = Array<Array<string>>();
    private maxLogsShown = 1000;
    private lastLog: any = null;
    private lastScrolledLog: any = null;
    private scrollTimer = timer(200, 200);
    private scrollTimerSubscription: Subscription = null;

    @ViewChild('logItemContainer', { static: false }) private container: ScrollableContainerComponent;

    constructor(public appStateService: AppStateService, public mqttService: MQTTService, public statusService: StatusService) {
        super(mqttService, statusService);
        this.scrollTimerSubscription = this.scrollTimer.subscribe(() => {
            this.scrollToBottom();
        });
    }

    ngOnInit() {
    }

    ngAfterViewChecked() {
    }

    ngAfterViewInit() {
    }

    ngOnChanges(changes: SimpleChanges) {
    }

    ngOnDestroy() {
        if (this.scrollTimerSubscription === null) {
            this.scrollTimerSubscription.unsubscribe();
        }
        this.mqttUnsubscribeAll();
    }

    public subscribeToTopics(topics: string[] = null, stripTopics: string[] = null, replaceTopics: string[][] = null) {
        if (topics == null) {

        } else {
            this.topics = topics;
        }

        if (stripTopics == null) {

        } else {
            this.stripTopics = stripTopics;
        }

        if (replaceTopics == null) {

        } else {
            this.replaceTopics = replaceTopics;
        }

        for (const index in this.topics) {
            this.mqttSubscribe(this.topics[index], (topic: string, payload: MQTTPayload) => { this.handleMessage(topic, payload); });
        }
    }

    private scrollToBottom() {
        if (this.appStateService.account.mqLogsAutoScroll) {
            if (this.lastScrolledLog != this.lastLog) {
                this.container.scrollToBottom();
                this.lastScrolledLog = this.lastLog;
            }
        }
    }

    private handleMessage(topic: string, payload: MQTTPayload) {
        var t = this.stripTopic(topic);
        t = this.replaceTopic(t);
        const log = { 'topic': t, 'message': payload.message, 'dateTime': payload.dateTime, 'complete': payload.dateTime + ' ' + t + ': ' + payload.message };
        this.lastLog = log;
        this.logs.push(log);
        while (this.logs.length > this.maxLogsShown) {
            this.logs.shift();
        }
    }

    private stripTopic(topic) {
        let t = topic;
        for (const index in this.stripTopics) {
            const strip = this.stripTopics[index];
            const re = new RegExp(strip, 'g');
            t = t.replace(re, '');
        }
        return t;
    }

    private replaceTopic(topic) {
        let t = topic;
        for (const index in this.replaceTopics) {
            const rep = this.replaceTopics[index][0];
            const repWith = this.replaceTopics[index][1];
            const re = new RegExp(rep, 'g');
            t = t.replace(re, repWith);
        }
        return t;
    }
}

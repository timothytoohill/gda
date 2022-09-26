import { Injectable } from '@angular/core';
import { AppStateService } from './app.state.service';
import { MQTTService } from './mqtt.service';

@Injectable()
export class LoggerService {
    constructor(private appStateService: AppStateService, private mqttService: MQTTService) {
    }

    public log(message: any, topic: string = 'status', includeConsole: boolean = true) {
        const fullTopic = this.getFullTopic(topic);
        if (includeConsole) {
            console.debug(fullTopic + ':', message);
        }
        let messageStr = '';
        if (message instanceof Object)
            messageStr = JSON.stringify(message, null, 4);
        else
            messageStr = message.toString();

        this.mqttService.publish(fullTopic, messageStr);
    }

    private getFullTopic(topic: string = ''): string {
        const appTopic = this.appStateService.getAppTopicUI();
        const userName = this.appStateService.getUserID(); // this.authService.getCurrentUserName();

        const prefix = this.appStateService.generateTopic([appTopic, userName]);

        let fullTopic = '';
        if (topic.length > 0) {
            fullTopic = prefix + '/' + topic;
        } else {
            fullTopic = prefix;
        }
        return fullTopic;
    }
}

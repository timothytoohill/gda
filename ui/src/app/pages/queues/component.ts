import { Component, OnDestroy, OnInit } from '@angular/core';
import { QueuesService, Queue } from '../../@core/services/queues.service';
import { Subscription } from 'rxjs';

@Component({ selector: 'queues', templateUrl: 'component.html', styleUrls: ['component.scss'] })
export class QueuesComponent implements OnDestroy {
    public queues: Queue[] = [];
    public newQueueName: string;

    private queueSubscription: Subscription = null;

    constructor(public queuesService: QueuesService) {
        this.queueSubscription = queuesService.queues.subscribe({
            next: (queues) => {
                this.queues = queues;
            },
        });
    }

    addQueue() {
        this.queuesService.addQueue(this.newQueueName);
    }

    ngOnDestroy() {
        if (this.queueSubscription) {
            this.queueSubscription.unsubscribe();
        }
    }
}

import { Component, ElementRef, Input, OnDestroy } from '@angular/core';
import { StatusService } from '../../../../@core/services/status.service';
import { AppStateService } from '../../../../@core/services/app.state.service';
import { MQTTService, MQTTPayload } from '../../../../@core/services/mqtt.service';
import { MQTTComponent } from '../mqtt.component';
import { timer, Subscription } from 'rxjs';

interface TreeNode<T> {
    data: T;
    children: TreeNode<T>[];
    expanded: boolean;
    parent: TreeNode<T>;
    isRemoved: boolean;
}

interface TreeEntry {
    topic: string;
    message: string;
    dateTime: string;
    lastActive: number;
}

interface TableEntry {
    topic: string;
    fullTopic: string;
    message: string;
    depth: number;
    show: boolean;
    treeNode: TreeNode<TreeEntry>;
    isActive: boolean;
    isRemoving: boolean;
    isRemoved: boolean;
    isKept: boolean;
    wasAutoKept: boolean;
    lastActive: number;
    lastCheckActive: number;
    dateTime: string;
    parent: TableEntry;
}

interface TableData {
    [key: string]: TableEntry;
}

@Component({ selector: 'mqtt-tree', templateUrl: 'mqtt.tree.component.html', styleUrls: ['mqtt.tree.component.scss'] })
export class MQTTTreeComponent extends MQTTComponent implements OnDestroy {
    public currentMessage: string = '';
    private lastMessage: string = '';
    private lastMessageTime: number = 0;
    private clearLastMessageInterval: number = 3000;
    private updateInterval = 500;
    private pruneInterval = 15000;
    private activityHighlightDelay = 500;
    private removingHighlightDelay = 20000;
    private removeDelay = 25000;
    private treeUpdateTimer = timer(0, this.updateInterval);
    private treeUpdateTimerSubscription: Subscription = null;
    private pruneTimer = timer(0, this.pruneInterval);
    private pruneTimerSubscription: Subscription = null;
    private needsPruning: boolean = false;

    public treeData: TreeNode<TreeEntry>[] = [];
    public tableData: TableData = {};
    public sortedTableKeys: string[];
    public topicCount: number = 0;
    public highlightedTopic: TableEntry = null;

    constructor(public mqttService: MQTTService, public statusService: StatusService, public appStateService: AppStateService) {
        super(mqttService, statusService);
        this.mqttSubscribe(this.appStateService.appConfigs['appOrganization'] + "/#", (topic: string, payload: any) => { this.handleMessage(topic, payload); });
        this.treeUpdateTimerSubscription = this.treeUpdateTimer.subscribe(() => {
            this.updateTableDataActivity();
        });
        this.pruneTimerSubscription = this.pruneTimer.subscribe(() => {
            // this.pruneTree();
        });
    }

    ngOnDestroy() {
        if (this.treeUpdateTimerSubscription === null) {

        } else {
            this.treeUpdateTimerSubscription.unsubscribe();
        }

        if (this.pruneTimerSubscription === null) {

        } else {
            this.treeUpdateTimerSubscription.unsubscribe();
        }
        this.mqttUnsubscribeAll();
    }

    private handleMessage(topic: string, payload: MQTTPayload) {
        const topics = topic.split('/');
        this.currentMessage = topic + ': ' + payload.message;
        this.treeBuild(topics, payload, this.treeData);
        this.updateTableData(this.treeData);
    }

    private pruneTree() {
        if (this.needsPruning) {
            this.treeData = [];
            for (const key in this.tableData) {
                const entry = this.tableData[key];
                const topics = key.split('/');
                this.treeBuild(topics, { dateTime: entry.dateTime, message: entry.message }, this.treeData, null, true);
            }
            this.tableData = {};
            this.updateTableData(this.treeData);
            this.needsPruning = false;
        }
    }

    private treeBuild(topics: string[], payload: MQTTPayload, tree: TreeNode<TreeEntry>[], parentNode: TreeNode<TreeEntry> = null, isPruning: boolean = false) {
        const topic = topics.shift();
        let node: TreeNode<TreeEntry>;
        let foundExisting: boolean = false;

        if (isPruning) {
            node = { data: { topic: topic, message: payload.message, dateTime: payload.dateTime, lastActive: Date.now() - this.activityHighlightDelay }, children: [], expanded: this.appStateService.account.mqTreeAutoExpand, parent: parentNode, isRemoved: false };
        } else {
            node = { data: { topic: topic, message: payload.message, dateTime: payload.dateTime, lastActive: Date.now() }, children: [], expanded: this.appStateService.account.mqTreeAutoExpand, parent: parentNode, isRemoved: false };
        }
        for (let index = 0; index < tree.length; index++) {
            const existingData = tree[index];
            if (existingData.data.topic == topic) {
                const data = existingData;
                data.data.message = node.data.message;
                data.data.dateTime = node.data.dateTime;
                data.data.lastActive = node.data.lastActive;
                data.isRemoved = false;
                foundExisting = true;
                node = data;
                break;
            }
        }

        if (!foundExisting) {
            tree.push(node);
        }

        if (topics.length > 0) {
            this.treeBuild(topics, payload, node.children, node);
        }
    }

    private updateTableKeys() {
        this.sortedTableKeys = Object.keys(this.tableData).sort();
        this.topicCount = this.sortedTableKeys.length;
    }

    private updateTableDataActivity() {
        for (const key in this.tableData) {
            const tableEntry = this.tableData[key] as TableEntry;
            const dtNow = Date.now();

            if (dtNow - tableEntry.lastActive > this.activityHighlightDelay) {
                tableEntry.isActive = false;
                tableEntry.isRemoving = false;
                tableEntry.isRemoved = false;
            }

            if (tableEntry.isKept) {
                const walkUpAndSet = (te: TableEntry, override: boolean = false) => {
                    if (te.wasAutoKept && !override) {

                    } else {
                        te.isRemoving = false;
                        te.isRemoved = false;
                        te.isKept = true;
                        te.wasAutoKept = true;
                    }

                    if (te.parent != null) {
                        walkUpAndSet(te.parent, override);
                    }
                };

                walkUpAndSet(tableEntry, !tableEntry.wasAutoKept);
            } else {
                if (this.appStateService.account.mqTreeAutoPrune) {
                    if (dtNow - tableEntry.lastCheckActive > this.removingHighlightDelay) {
                        tableEntry.isRemoving = true;
                    }

                    if (dtNow - tableEntry.lastCheckActive > this.removeDelay) {
                        tableEntry.isRemoved = true;
                        tableEntry.treeNode.isRemoved = true;
                        this.needsPruning = true;
                    }
                } else {
                    tableEntry.lastCheckActive = dtNow;
                }
            }
        }

        const nowDT = Date.now();
        if (this.lastMessage == this.currentMessage) {
            if ((nowDT - this.lastMessageTime) > this.clearLastMessageInterval) {
                this.currentMessage = '';
            }
        } else {
            this.lastMessage = this.currentMessage;
            this.lastMessageTime = nowDT;
        }
    }

    private updateTableData(treeData: TreeNode<TreeEntry>[], topicPath: string = '', depth: number = 0, show: boolean = true, parent: TableEntry = null) {
        for (let i = 0; i < treeData.length; i++) {
            const treeNode = treeData[i];
            const data = treeNode.data;
            const path = topicPath + (topicPath.length > 0 ? '/' : '') + data.topic;
            const lastActive = Date.now();

            if (path in this.tableData) {
                const tableEntry = this.tableData[path] as TableEntry;
                tableEntry.show = show;
                tableEntry.message = data.message;

                if (data.dateTime == tableEntry.dateTime) {
                } else {
                    tableEntry.lastActive = lastActive;
                    tableEntry.isActive = true;
                    tableEntry.dateTime = data.dateTime;
                    tableEntry.isRemoving = false;
                    tableEntry.isRemoved = false;
                }
            } else {
                const newTableEntry: TableEntry = { topic: data.topic, message: data.message, depth: depth, show: show, treeNode: treeNode, fullTopic: path, isActive: true, lastActive: lastActive, lastCheckActive: lastActive, dateTime: data.dateTime, isRemoving: false, isRemoved: false, isKept: false, wasAutoKept: false, parent: parent };
                this.tableData[path] = newTableEntry;
            }

            let trueShow = show;
            if (!treeNode.expanded) {
                trueShow = false;
            }

            this.updateTableData(treeNode.children, path, depth + 1, trueShow, this.tableData[path]);
        }

        this.updateTableKeys();
    }

    public getTableSeperator(tableEntry: TableEntry) {
        const sep: string = '>';

        if (tableEntry.treeNode.children.length > 0) {
            if (tableEntry.treeNode.expanded) {
                return '|==='.repeat(tableEntry.depth) + 'V';
            } else {
                return '|==='.repeat(tableEntry.depth) + '>';
            }
        } else {
            return '|==='.repeat(tableEntry.depth);
        }
    }

    public highlightTopic(tableEntry: TableEntry) {
        this.highlightedTopic = tableEntry;
    }

    public toggleExpanded(tableEntry: TableEntry) {
        const expanded = tableEntry.treeNode.expanded;
        tableEntry.treeNode.expanded = !expanded;
        this.updateTableData(this.treeData);
    }
}

import { Component, Directive, OnDestroy, OnInit, ViewChild, ElementRef, TemplateRef, NgZone, ViewContainerRef, AfterViewInit, AfterViewChecked } from '@angular/core';
import { Router, Params, ActivatedRoute } from '@angular/router';
import { MQTTComponent } from '../../@core/components/mqtt/mqtt.component';
import { MQTTLogsComponent } from '../../@core/components/mqtt/logs/mqtt.logs.component';
import { MQTTService } from '../../@core/services/mqtt.service';
import { LoggerService } from '../../@core/services/logger.service';
import { AppService } from '../../@core/services/app.service';
import { AppAccountService } from '../../@core/services/app.account.service';
import { AppUIService } from '../../@core/services/app.ui.service';
import { AppStateService } from '../../@core/services/app.state.service';
import { MiscUtils } from '../../@core/utils/miscutils';
import { StatusService, StatusState } from '../../@core/services/status.service';
import { Subscription } from 'rxjs';
import { ShowcaseDialogComponent } from '../modal-overlays/dialog/showcase-dialog/showcase-dialog.component';
import { NbDialogService, NbTabsetComponent } from '@nebular/theme';
import { timer } from 'rxjs';

declare function ForceGraph(): any;
declare function ForceGraph3D(controlType: any): any;
declare var THREE: any;
declare function SpriteText(id: any): void;
declare function resizableGrid(element: any, id: string): void;

@Component({ selector: 'ngx-dashboard', styleUrls: ['./dashboard.component.scss'], templateUrl: './dashboard.component.html' })
export class DashboardComponent extends MQTTComponent implements OnDestroy, OnInit, AfterViewInit, AfterViewChecked {
    public currentQueryObj = null;
    public currentRunningQueryObj = null;
    private previousQueryObj = null;

    public dashboardTopics = [];
    public stripTopics = [];
    public replaceTopics = Array<Array<string>>();
    public isQueryRunning = false;
    public queryStatusBox = 'primary';
    public queryStatus = '';
    public queryError = '';
    public runningQuery = '';
    public runningTraversalDepth = 0;
    public runningMaxEdges = -1;
    public runningAppendResults = true;
    public totalEdges: number = 0;
    public totalNodes: number = 0;
    public currentEdges: number = 0;
    public currentNodes: number = 0;
    public savedQueries: any[] = [];
    public nodes = {};
    public edges = {};
    public nodesArray: any[] = [];
    public edgesArray: any[] = [];
    public internalNodesArray: any[] = [];
    public internalEdgesArray: any[] = [];
    public highlightedNode: any = null;
    public selectedNode: any = null;
    public queryExplain: string = '';
    public queryProfile: string = '';
    public isExplaining: boolean = false;
    public isRunningAllHistory = false;
    private isSavingQuery = false;
    private isAutoSavingQuery = false;

    public graphDBLoadUpdateTimer = timer(10000, 10000);
    private isGraphDBLoadStatusUpdating = false;
    public graphDBLoadUpdateTimerSubscription: Subscription = null;
    public graphDBLoadStatus = '';

    public viewerLabel: string = 'Select a node or edge';
    public viewerID: string = '';

    private lastQueryID = '';
    private querySubscription: Subscription = null;
    private queryResultCount = 0;
    private queryMainStatus: StatusState;
    private queryDownloadStatus: StatusState;
    private addGraphDBQueryTopic: string = '';
    private deleteGraphDBQueryTopic: string = '';
    private queryHadErrors: boolean = false;
    public isSourceDocLoaded: boolean = false;
    public isLoadingSourceDoc: boolean = false;
    public sourceDocURL = '';
    private queryObjFields = ['query', 'traversalDepth', 'maxEdges', 'appendResults'];
    private graphAnimationTimer = timer(1000, 10);
    private graphAnimationTimerSubscription: Subscription = null;
    private animationDistance = 300;
    private wasAnimating = false;
    private graph2D: any = null;
    private graph3D: any = null;
    private graph2DLastQueryID = '';
    private graph3DLastQueryID = '';
    public graph2DMessage = '';
    public graph3DMessage = '';

    private updateTimer = timer(300, 300);
    private updateTimerSubscription: Subscription = null;
    private updateUISize: boolean = false;

    private autoSaveTimer = timer(10000, 10000);
    private autoSaveTimerSubscription: Subscription;

    private lastSelectedQueryTab: number = -1;
    private lastSelectedGraphTab: number = -1;
    private graph2DDataLoaded: boolean = false;
    private graph3DDataLoaded: boolean = false;
    private graph2DFirstZoom = true;
    private graph3DFirstZoom = true;

    private queryCount = 0;

    private graphErrorMessage = 'Remote Desktop Session? <br/><br/>Try using Firefox.<br/><br/>Most likely the graphics context could not be created due to the brower\'s requirement for creating only hardware-accelerated graphics contexts.<br/><br/>';
    @ViewChild('graph2DContainer', { static: false }) private graph2DContainer: ElementRef;
    @ViewChild('parentGraph1', { static: false }) private parentGraph1: ElementRef;
    @ViewChild('graph3DContainer', { static: false }) private graph3DContainer: ElementRef;
    @ViewChild('parentGraph2', { static: false }) private parentGraph2: ElementRef;

    @ViewChild('queryTabs', { static: false }) private queryTabs: NbTabsetComponent;
    @ViewChild('graphTabs', { static: false }) private graphTabs: NbTabsetComponent;
    @ViewChild('resultsTableNodes', { static: false }) private resultsTableNodes: ElementRef;
    @ViewChild('resultsTableEdges', { static: false }) private resultsTableEdges: ElementRef;

    @ViewChild('mainTable', { static: false }) private mainTable: ElementRef;
    @ViewChild('mqLogs', { static: false }) private mqLogs: MQTTLogsComponent;

    constructor(private appAccountService: AppAccountService, private appUIService: AppUIService, private activatedRoute: ActivatedRoute, private router: Router, public mqttService: MQTTService, private dialogService: NbDialogService, private loggerService: LoggerService, private appService: AppService, public statusService: StatusService, public appStateService: AppStateService) {
        super(mqttService, statusService);
        this.currentQueryObj = this.buildQuery();
        this.currentRunningQueryObj = this.currentQueryObj;
    }

    ngOnInit() {
    }

    ngAfterViewInit() {
        timer(1000).subscribe(() => {
            this.init();
        });
    }

    ngAfterViewChecked() {
        this.updateUISize = true;
    }

    ngOnDestroy() {
        this.uninit();
    }

    async init() {
        this.appStateService.init().then(() => {
            const id = this.appStateService.getUserID();
            const appTopicUI = this.appStateService.getAppTopicUI();
            const appTopicAPI = this.appStateService.getAppTopicAPI();
            const appTopicUIForThisUser = this.appStateService.getAppTopicUIForThisUser();
            const appTopicAPIForThisUser = this.appStateService.getAppTopicAPIForThisUser();

            this.dashboardTopics = [appTopicUIForThisUser + '/#', appTopicAPIForThisUser];
            this.stripTopics = [appTopicUIForThisUser + "/", appTopicAPI];
            this.replaceTopics = [["/.*/.*/" + id, "server"]];

            this.mqLogs.subscribeToTopics(this.dashboardTopics, this.stripTopics, this.replaceTopics);

            this.addGraphDBQueryTopic = this.appStateService.generateTopic([appTopicUI, 'add-graphdb-query']);
            this.deleteGraphDBQueryTopic = this.appStateService.generateTopic([appTopicUI, 'delete-graphdb-query']);

            this.mqttSubscribe(this.addGraphDBQueryTopic, (topic, payload) => {
                const newQ = JSON.parse(payload.message);
                for (const index in this.savedQueries) {
                    const q = this.savedQueries[index];
                    if (q.queryName === newQ.queryName) {
                        if (q.id === newQ.id) {
                            return;
                        } else {
                            MiscUtils.mergeDictionaries(newQ, q, false);
                            if (this.appStateService.account.queryName === q.queryName) {
                                this.loggerService.log('Another user is updating this query.');
                                // this.setCurrentQuery(q);
                            } else {
                                this.loggerService.log('Another user has updated query \'' + newQ.queryName + '\'.');
                            }
                            return;
                        }
                    }
                }
                this.loggerService.log('Another user has added a query \'' + newQ.queryName + '\'.');
                this.savedQueries.push(newQ);
            });

            this.mqttSubscribe(this.deleteGraphDBQueryTopic, (topic, payload) => {
                const delQ = JSON.parse(payload.message);
                const newSet = [];
                let found = false;
                for (const index in this.savedQueries) {
                    const q = this.savedQueries[index];
                    if (q.queryName === delQ.queryName) {
                        found = true;
                    } else {
                        newSet.push(q);
                    }
                }
                if (found) {
                    this.loggerService.log('Another user has deleted saved query ' + delQ['queryName'] + '\'.');
                    this.savedQueries = newSet;
                }
            });
        });

        this.updateTimerSubscription = this.updateTimer.subscribe(() => {
            this.update();
        });

        timer(1000).subscribe(() => {
            this.selectTab(this.queryTabs, 0);
            this.selectTab(this.graphTabs, 0);
        });

        timer(5000).subscribe(() => {
            if (this.appStateService.account.isAnonymous) {
                this.appStateService.account.stopAnimationOnMouseOver = true;
            }
        });

        this.createGraphs();

        this.graphDBLoadUpdateTimerSubscription = this.graphDBLoadUpdateTimer.subscribe(() => {
            if (this.appStateService.account.currentGraphDBLoadID.length > 0) {
                this.updateGraphDBLoadStatus();
            }
        });

        let angle = 0;
        this.graphAnimationTimerSubscription = this.graphAnimationTimer.subscribe(() => {
            if (this.graph3D) {
                if (this.appStateService.account.animateGraph) {
                    if (this.wasAnimating) {
                        const animationDistance = this.animationDistance;
                        this.graph3D.cameraPosition({ x: animationDistance * Math.sin(angle), z: animationDistance * Math.cos(angle) });
                        angle += Math.PI / 300;
                    } else {
                        this.wasAnimating = true;
                        this.animationDistance = this.graph3D.cameraPosition().z;
                    }
                } else {
                    this.wasAnimating = false;
                }
            }
        });

        this.loadSavedQueries().then(() => {
            if (this.appStateService.account.isAnonymous) {
                if (this.doesURLHaveQuery()) {
                    this.setQueryFromURL(true);
                } else {
                    this.executeQuery();
                }
            } else {
                const q = this.appStateService.account.queryName;
                if (this.doesSavedQueryExist(q)) {
                    const queryObj = this.getSavedQuery(q);
                    this.setCurrentQuery(queryObj);
                }
                if (this.doesURLHaveQuery()) {
                    this.setQueryFromURL(true);
                }
            }
        });

        this.autoSaveTimer.subscribe(() => {
            this.autoSave();
        });
    }

    uninit() {
        this.cancelQuery();
        this.mqttUnsubscribeAll();
        if (this.querySubscription === null) {

        } else {
            this.querySubscription.unsubscribe();
            this.queryMainStatus.setErrorStatus();
            this.queryDownloadStatus.setErrorStatus();
            this.graphAnimationTimerSubscription.unsubscribe();
            this.updateTimerSubscription.unsubscribe();
            this.graphDBLoadUpdateTimerSubscription.unsubscribe();
            this.autoSaveTimerSubscription.unsubscribe();
        }
    }

    leftClick(nodeEdge) {
        this.selectNode(nodeEdge);
    }

    rightClick(nodeEdge) {
        this.runNodeQuery(this.filterNode(nodeEdge));
        return false;
    }

    autoSave() {
        if (this.appStateService.account.autoSaveQuery && !this.appStateService.account.isAnonymous) {
            if (this.isAutoSavingQuery || this.isRunningAllHistory) {

            } else {
                this.isAutoSavingQuery = true;
                if (!this.isQueryRunning && this.doesSavedQueryExist(this.appStateService.account.queryName)) {
                    if (this.previousQueryObj === null) {
                        this.updatePreviousQuery(this.getCurrentQueryObj());
                    } else {
                        if (MiscUtils.areDictionariesTheSame(this.currentQueryObj, this.previousQueryObj)) {

                        } else {
                            this.updatePreviousQuery(this.getCurrentQueryObj());
                            this.loggerService.log('Auto saving query...');
                            this.saveQuery().then(() => {
                                this.loggerService.log('Done auto saving query.');
                                this.isAutoSavingQuery = false;
                            });
                            return;
                        }
                    }
                }
                this.isAutoSavingQuery = false;
            }
        }
    }

    updatePreviousQuery(queryObj) {
        this.previousQueryObj = {};
        MiscUtils.mergeDictionaries(queryObj, this.previousQueryObj);
    }

    canSave() {
        if (this.doesSavedQueryExist(this.appStateService.account.queryName)) {
            if (this.currentQueryObj['queryOwner'] == '' || this.currentQueryObj['queryOwner'] == 'Anonymous') {
                return true;
            } else {
                if (this.currentQueryObj['allowSave'] || this.currentQueryObj['queryOwner'] == this.appStateService.account.queryName) {
                    return true;
                }
            }
        } else {
            return true;
        }

        return false;
    }

    allowAutoSave() {
        if (this.appStateService.account.isAnonymous) {
            return false;
        } else {
            if (this.doesSavedQueryExist(this.appStateService.account.queryName)) {
                if (this.currentQueryObj['queryOwner'] == '' || this.currentQueryObj['queryOwner'] == 'Anonymous') {
                    return true;
                } else {
                    if (this.currentQueryObj['allowSave'] || this.currentQueryObj['queryOwner'] == this.appStateService.account.name) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    stopAnimation(isMouseOver = false) {
        if (isMouseOver) {
            if (this.appStateService.account.stopAnimationOnMouseOver) {
                this.appStateService.account.animateGraph = false;
            }
        } else {
            this.appStateService.account.animateGraph = false;
        }
    }

    zoomAnimation(e: any) {
        if (this.appStateService.account.animateGraph) {
            e.preventDefault();
            this.animationDistance += e.deltaY;
        }
    }

    createGraphs(index = -1) {
        if (index == -1 || index == 0) {
            if (this.graph2DContainer != null) {
                const elem = this.graph2DContainer.nativeElement;
                try {
                    this.graph2D = ForceGraph();
                    this.graph2D(elem)
                        .nodeId('~id')
                        .nodeLabel(node => this.getNodeLabel(node))
                        .linkLabel(link => this.getEdgeLabel(link))
                        .linkSource('~inV')
                        .linkTarget('~outV')
                        .nodeVal(2) //(node => node['~maxTraverseLevel'] - node['~traverseLevel'])
                        .nodeRelSize(7)
                        .linkCanvasObjectMode(() => 'after')
                        .linkCanvasObject((link, ctx) => {
                            const MAX_FONT_SIZE = 6;
                            const LABEL_NODE_MARGIN = this.graph2D.nodeRelSize() * 0.5;
              
                            const start = link.source;
                            const end = link.target;
              
                            // ignore unbound links
                            if (typeof start !== 'object' || typeof end !== 'object') return;
              
                            // calculate label positioning
                            const textPos = Object.assign({}, ...['x', 'y'].map(c => ({
                              [c]: start[c] + (end[c] - start[c]) / 2 // calc middle point
                            })));
              
                            const relLink = { x: end.x - start.x, y: end.y - start.y };
              
                            const maxTextLength = Math.sqrt(Math.pow(relLink.x, 2) + Math.pow(relLink.y, 2)) - LABEL_NODE_MARGIN * 2;
              
                            let textAngle = Math.atan2(relLink.y, relLink.x);
                            // maintain label vertical orientation for legibility
                            if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
                            if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);
              
                            let label = `${link.source.id} > ${link.target.id}`;
                            label = this.getEdgeLabel(link);
              
                            // estimate fontSize to fit in link length
                            ctx.font = '1px Sans-Serif';
                            const calcFontSize = maxTextLength / ctx.measureText(label).width;
                            if (calcFontSize < 12) return;
                            const fontSize = Math.min(MAX_FONT_SIZE, maxTextLength / ctx.measureText(label).width);
                            if (fontSize < 1) return;
                            ctx.font = `${fontSize}px Sans-Serif`;
                            const textWidth = ctx.measureText(label).width;
                            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding
              
                            // draw text label (with background rect)
                            ctx.save();
                            ctx.translate(textPos.x, textPos.y);
                            ctx.rotate(textAngle);
              
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.0)';
                            ctx.fillRect(- bckgDimensions[0] / 2, - bckgDimensions[1] / 2, ...bckgDimensions);
              
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillStyle = 'white';
                            ctx.fillText(label, 0, 0);
                            ctx.restore();
                        })
                        .nodeAutoColorBy(node => this.getNodeLabel(node))
                        .linkAutoColorBy(link => this.getEdgeLabel(link))
                        .nodeCanvasObjectMode(node => 'after')
                        .onNodeDragEnd(node => { node.fx = node.x; node.fy = node.y; })
                        .onNodeHover(node => elem.style.cursor = node ? 'pointer' : null)
                        .onNodeClick(node => { this.leftClick(node); })
                        .onNodeRightClick(node => { this.rightClick(node); })
                        .onLinkClick(link => { this.leftClick(link); })
                        .onLinkRightClick(link => { this.rightClick(link); })
                        .nodeCanvasObject((node, ctx, globalScale) => {
                            const label = this.getNodeLabel(node);
                            let fontSize = 12 / globalScale;
                            fontSize = fontSize > 5 ? fontSize : 5;
                            ctx.font = `${fontSize}px Sans-Serif`;
                            const textWidth = ctx.measureText(label).width;
                            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding
                            ctx.fillStyle = 'rgba(255, 255, 255, 0)';
                            ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.globalCompositeOperation = 'difference';
                            ctx.fillStyle = node.color;
                            ctx.fillText(label, node.x, node.y);
                        })
                        .d3VelocityDecay(0.3)
                        .warmupTicks(10).cooldownTicks(100);
                    this.graph2DMessage = '';
                } catch (e) {
                    this.graph2D = null;
                    this.loggerService.log('Error creating 2D graph: ' + MiscUtils.getString(e));
                    this.graph2DMessage = this.graphErrorMessage + '<br/>' + MiscUtils.getString(e);
                }
            }
        }

        if (index == -1 || index == 1) {
            if (this.graph3DContainer != null) {
                const elem = this.graph3DContainer.nativeElement;
                try {
                    this.graph3D = ForceGraph3D({ controlType: 'orbit' });
                    this.graph3D(elem)
                        .nodeId('~id')
                        .nodeLabel(node => this.getNodeLabel(node))
                        .linkLabel(link => this.getEdgeLabel(link))
                        .linkSource('~inV')
                        .linkTarget('~outV')
                        .nodeVal(node => node['~maxTraverseLevel'] - node['~traverseLevel'])
                        .nodeRelSize(4)
                        .nodeAutoColorBy(node => this.getNodeLabel(node))
                        .linkAutoColorBy(link => this.getEdgeLabel(link))
                        .onNodeClick(node => { this.leftClick(node); })
                        .onNodeRightClick(node => { this.rightClick(node); })
                        .onNodeDragEnd(node => { node.fx = node.x; node.fy = node.y; node.fz = node.z; })
                        .onLinkClick(link => { this.leftClick(link); })
                        .onLinkRightClick(link => { this.rightClick(link); })
                        .cameraPosition({ z: this.animationDistance })
                        .linkThreeObjectExtend(true)
                        .linkWidth(1)
                        .linkThreeObject(link => {
                            // extend link with text sprite
                            const sprite = new SpriteText(`${this.getEdgeLabel(link)}`);
                            sprite.color = 'lightgrey';
                            sprite.textHeight = 4;
                            return sprite;
                        })
                        .linkPositionUpdate((sprite, { start, end }) => {
                            const middlePos = Object.assign({}, ...['x', 'y', 'z'].map(c => ({
                                [c]: start[c] + (end[c] - start[c]) / 2, // calc middle point
                            })));
                            // Position sprite
                            Object.assign(sprite.position, middlePos);
                        })
                        .nodeThreeObjectExtend(true)
                        .nodeThreeObject(node => {
                            // use a sphere as a drag handle
                            const obj = new THREE.Mesh(
                                new THREE.SphereGeometry(10),
                                new THREE.MeshBasicMaterial({ depthWrite: false, transparent: true, opacity: 0 }),
                            );
                            // add text sprite as child
                            const sprite = new SpriteText(this.getNodeLabel(node));
                            sprite.color = node.color;
                            sprite.textHeight = 8;
                            obj.add(sprite);
                            return obj;
                        })
                        .width(50).height(50)
                        .warmupTicks(10).cooldownTicks(100);
                    this.graph3D.d3Force('charge').strength(-100);
                    this.graph3DMessage = '';
                } catch (e) {
                    this.graph3D = null;
                    this.loggerService.log('Error creating 3D graph: ' + MiscUtils.getString(e));
                    this.graph3DMessage = this.graphErrorMessage + '<br/>' + MiscUtils.getString(e);
                }
            }
        }
    }

    update() {
        this.updateQueryUI();
        if (!this.isQueryRunning) {
            this.loadSelectedGraphs();
        }
    }

    updateQueryUI() {
        if (this.updateUISize) {
            this.updateGraphSizing();
            resizableGrid(this.mainTable.nativeElement, '1');
            this.updateUISize = false;
        }
        this.queryStatusBox = 'primary';
        if (this.appStateService.account.showGraphEdgeWarningMessage) {
            if (this.doesQueryContainExpensiveEdgeQuery()) {
                this.queryStatusBox = 'info';
            }
        }
        if (this.isQueryRunning) {
            this.queryStatusBox = 'warning';
        }
        if (this.queryHadErrors) {
            this.queryStatusBox = 'danger';
        }

        this.resumeAnimations();
    }

    resumeAnimations() {
        const qt = this.getSelectedTab(this.queryTabs);
        const gt = this.getSelectedTab(this.graphTabs);
        if (qt == 0) {
            if (qt != this.lastSelectedQueryTab) {
                this.resumeAnimation(gt);
            }
        } else if (gt != this.lastSelectedGraphTab) {
            this.resumeAnimation(gt);
        }
        this.lastSelectedQueryTab = this.getSelectedTab(this.queryTabs);
        this.lastSelectedGraphTab = this.getSelectedTab(this.graphTabs);
    }

    resumeAnimation(gt: number) {
        if (gt == 0) {
            if (this.graph2D) {
                if (this.graph2DDataLoaded) {
                    this.graph2D.resumeAnimation();
                }
            }
        } else if (gt == 1) {
            if (this.graph3D) {
                if (this.graph3DDataLoaded) {
                    this.graph3D.resumeAnimation();
                }
            }
        }
    }

    updateGraphSizing() {
        if (this.getSelectedTab(this.queryTabs) == 0) {
            if (this.getSelectedTab(this.graphTabs) == 0) {
                this.updateSingleGraphSize(this.parentGraph1.nativeElement, this.graph2D);
            }
            if (this.getSelectedTab(this.graphTabs) == 1) {
                this.updateSingleGraphSize(this.parentGraph2.nativeElement, this.graph3D);
            }
        }
    }

    updateSingleGraphSize(elem, graph) {
        if (graph != null) {
            const rect = elem.getBoundingClientRect();
            let width = rect.width;
            let height = rect.height;
            let setNow = false;
            let lastRect = null;
            if ('lastRect' in elem) {
                lastRect = elem.lastRect;
                if (width == lastRect.width && height == lastRect.height) {
                } else {
                    setNow = true;
                }
            } else {
                setNow = true;
            }
            if (setNow) {
                if (width < 50) width = 50;
                if (height < 50) height = 50;
                graph.width(width - 4).height(height - 4);
                elem.lastRect = rect;
            }
        }
    }

    loadSelectedGraphs(force = false) {
        if (this.getSelectedTab(this.queryTabs) == 0) {
            if (this.getSelectedTab(this.graphTabs) == 0) {
                if (this.graph2D) {
                    if (this.graph2DLastQueryID !== this.lastQueryID || force) {
                        try {
                            this.loadSelectedGraph(this.graph2D);
                            this.graph2D.onEngineStop(() => { 
                                if (this.graph2DFirstZoom) {
                                    this.pinNodesAfterLoad();
                                    this.graph2D.zoomToFit(400);
                                    this.graph2DFirstZoom = false;
                                } else {
                                    this.graph2D.onEngineStop(() => { });
                                }
                            }); //don't do zoomToFit or pin after first time
                            this.graph2DDataLoaded = true;
                            this.graph2DLastQueryID = this.lastQueryID;
                        } catch (e) {
                            this.loggerService.log('Error: ' + MiscUtils.getString(e) + ' - recreating 2D graph.');
                            this.graph2D = null;
                            this.createGraphs(0);
                        }
                    }
                }
            } else if (this.getSelectedTab(this.graphTabs) == 1) {
                if (this.graph3D) {
                    if (this.graph3DLastQueryID !== this.lastQueryID || force) {
                        try {
                            this.loadSelectedGraph(this.graph3D);
                            this.graph3D.onEngineStop(() => { 
                                if (this.graph3DFirstZoom) {
                                    this.pinNodesAfterLoad();
                                    //this.graph3D.zoomToFit(400);
                                    this.graph3DFirstZoom = false;
                                } else {
                                    this.graph3D.onEngineStop(() => { });
                                }
                            }); //don't do zoomToFit or pin after first time
                            this.graph3DDataLoaded = true;
                            this.graph3DLastQueryID = this.lastQueryID;
                        } catch (e) {
                            this.loggerService.log('Error: ' + MiscUtils.getString(e) + ' - recreating 3D graph.');
                            this.graph3D = null;
                            this.createGraphs(1);
                        }
                    }
                }
            }
        }
    }

    getNodesCopy(nodesArray) {
        const newNodesArray = [];
        for (const i in nodesArray) {
            const newNode = {};
            MiscUtils.mergeDictionaries(nodesArray[i], newNode, false);
            newNodesArray.push(newNode);
        }
        return newNodesArray;
    }

    getEdgesCopy(edgesArray) {
        const newEdgesArray = [];
        for (const i in edgesArray) {
            const newEdge = {};
            MiscUtils.mergeDictionaries(edgesArray[i], newEdge, false);
            newEdgesArray.push(newEdge);
        }
        return newEdgesArray;
    }

    resetGraphs() {
        if (this.graph2D) {
            this.graph2D.graphData({ nodes: [], links: [] });
            this.graph2DDataLoaded = false;
        }
        if (this.graph3D) {
            this.graph3D.graphData({ nodes: [], links: [] });
            this.graph3DDataLoaded = false;
        }
    }

    loadSelectedGraph(graphObj) {
        this.internalNodesArray = this.getNodesCopy(this.nodesArray);
        let testedEdgesArray = [];
        //make sure each edge has nodes before adding
        for (let key in this.edges) {
            let edge = this.edges[key];
            if ((edge["~inV"] in this.nodes) && (edge["~outV"] in this.nodes)) {
                testedEdgesArray.push(edge);
            }
        }
        this.internalEdgesArray = testedEdgesArray;
        graphObj.graphData({ nodes: this.internalNodesArray, links: this.internalEdgesArray });
    }

    pinNodesAfterLoad() {
        for (let id in this.internalNodesArray) {
            let node = this.internalNodesArray[id]
            node.fx = node.x; node.fy = node.y;
            if ("z" in node) {
                node.fz = node.z;
            }
        }
    }
    
    selectTab(tabset: NbTabsetComponent, index: number) {
        tabset.tabs.forEach((tab, i) => {
            if (index == i) {
                tab.active = true;
            } else {
                tab.active = false;
            }
        });
    }

    getSelectedTab(tabset: NbTabsetComponent): number {
        let i = -1;
        tabset.tabs.forEach((tab, index) => {
            if (tab.activeValue) {
                i = index;
                return;
            }
        });
        return i;
    }

    doesQueryContainExpensiveEdgeQuery() {
        return (this.currentQueryObj.query.includes('inE') || this.currentQueryObj.query.includes('bothE') || this.currentQueryObj.query.includes('drop()') || this.currentQueryObj.query.includes('.path('));
    }

    doesSavedQueryExist(queryName: string) {
        for (const index in this.savedQueries) {
            const q = this.savedQueries[index];
            if (q.queryName === queryName) {
                return true;
            }
        }
        return false;
    }

    explainMaxEdges() {
        this.showMessage('Max Edges', 'The maxium number of edges to enumerate for each node at each depth of traversal. Primarily for visualization. Set to -1 for no limit. If you run an edge query (where edges are the result of your query), it will not limit the number of edges enumerated by the initial query. Use limit() if you need to restrict the initial number of edges produced by your edge query. When query results are traversed, the server follows the edges connected to the node to the next set of nodes and repeats the traversal. For nodes that are highly connected (have many edges), you can limit the number of edges that will be enumerated for each node at each depth of traversl with this parameter.');
    }

    explainDepth() {
        this.showMessage('Depth', 'The maximum depth to traverse the graph, starting with the nodes or edges that result from your query. If you run an edge query, the two nodes at either end of the edge are used to start the traversal. The number of edges enumerated for each node at each depth of traversal can be specified.');
    }

    explainAppend() {
        this.showMessage('Append Results', 'This platform maintains an internal, in-memory array of the nodes and edges produced by a query. As you run queries, the results of the queries can be aggregated. This means that nodes and edges resulting from a query are added to the graph. If you do not \'Append\' the results, the graph is cleared (meaning, the internal array of nodes and edges is reset) each time you run a query.');
    }

    explainAutoSave() {
        this.showMessage('Auto Save', 'Auto-save works if you create a profile and if you have already named and saved your query at least once. Profiles do not require a password and only exist to let you save your settings for the next time you use this application. Once you initally save your query, you will have the option to have the system \'auto-save\' your query thereafter. Any time you make a change to a query, the system will detect the change and save automatically. If you use a profile, your settings are automatically saved, including the query auto-save setting.');
    }

    explainQuery() {
        this.showMessage('Graph DB Gremlin Query', 'The gremlin query to run against the graph database. ');
    }

    explainMapping() {
        this.showMessage('Label Mapping', '<div style=\'font-size:0.8em\'>This is for UI visualization only - only the UI\'s 2D, 3D, and result table show label mappings. Query downloads and the loading of sub-graphs are not affected by label mappings.<br/><br/>The platform learns the properties of nodes/edges as you run queries. The bottom lists show property names that the platform has tracked. You can add those properties to the list of properties that could map to a node/edge label.<br/><br>The properties are mapped according to priority. When the graph goes to render the label for a node or edge, it will start at the top of the priority list and work its way down until it finds a property on the node/edge that is in the list.<br/><br/>Nodes and edges can have a set cardinality. This means that each property of a node or edge can have multiple values (an array of values per property). In order to map a node or edge\'s label, it has to choose one of those property values. A value of -1 means it will use all values of the property as the label. Recommend leaving it at -1 or 0 to ensure it is always able to obtain a value. If you specify an out-of-bounds index, it will default to using all property values.<br/><br/>You can specify the node/edge types (lables) for which the mapping will apply. As the platform learns the properties of each node and edge returned from your queries, it tracks which labels have that property name. If you leave the lables empty, it will apply to all nodes/edges of all types (of any label).<br/><br/>The list of labels on which to match is comma separated. If labels are specified, and if none match, then the UI will move down the priority list.<br/><br/>Simply adding the property from the list of learned properties with the default values should be sufficient for most mapping needs.</div>');
    }

    explainAllowSave() {
        this.showMessage('Allow save', 'If you are using a profile, you can prevent other users from saving this query if you are the one who created it.');
    }

    showMessage(title: string, message: string, showCancel = false, okCallback = null, cancelCallback = null) {
        return this.dialogService.open(ShowcaseDialogComponent, {
            context: {
                title: title,
                message: message,
                okCallback: okCallback,
                showCancel: showCancel,
            },
        });
    }

    async startGraphDBLoad() {
        const queryMessage = 'Starting Graph DB load...';
        const queryMainStatus = await this.statusService.setStatus(queryMessage, false);
        const data = this.buildQuery();
        this.appService.makeStreamingAPIPOSTCall('/graphdb-load', data).subscribe((response) => {
            if (response.isSuccess) {
                for (const index in response.results) {
                    const result = response.results[index];
                    this.setGraphDBLoadStatus(result);
                    if ('payload' in result) {
                        if ('loadId' in result['payload']) {
                            this.appStateService.account.currentGraphDBLoadID = result['payload']['loadId'];
                        }
                    }
                }
            } else {
                queryMainStatus.updateStatus('Graph DB load error: ' + response.message);
            }
        }, (error) => {
            queryMainStatus.setCompleteStatus('Graph DB load had errors..');
            this.loggerService.log('Graph DB load error: ' + MiscUtils.getString(error));
        }, () => {
            queryMainStatus.setCompleteStatus('Graph DB load started.');
            if (this.appStateService.account.currentGraphDBLoadID.length > 0) {
                this.updateGraphDBLoadStatus();
            }
        });

    }

    async cancelGraphDBLoad() {
        const queryMessage = 'Cancelling Graph DB load...';
        const queryMainStatus = await this.statusService.setStatus(queryMessage, false);
        const data = this.buildQuery();
        data['loadID'] = this.appStateService.account.currentGraphDBLoadID;
        this.appService.makeStreamingAPIPOSTCall('/graphdb-cancel-load', data).subscribe((response) => {
            if (response.isSuccess) {
                for (const index in response.results) {
                    const result = response.results[index];
                    this.setGraphDBLoadStatus(result);
                }
            } else {
                queryMainStatus.updateStatus('Graph DB cancel error: ' + response.message);
            }
        }, (error) => {
            queryMainStatus.setCompleteStatus('Graph DB cancel had errors..');
            this.loggerService.log('Graph DB cancel error: ' + MiscUtils.getString(error));
        }, () => {
            queryMainStatus.setCompleteStatus('Graph DB load cancelled.');
            if (this.appStateService.account.currentGraphDBLoadID.length > 0) {
                this.updateGraphDBLoadStatus();
            }
        });

    }

    updateGraphDBLoadStatus() {
        if (this.isGraphDBLoadStatusUpdating) {

        } else {
            this.isGraphDBLoadStatusUpdating = true;
            this.appService.makeStreamingAPIPOSTCall('/graphdb-load-status', { graphDBEndpoint: this.appStateService.account.graphDBEndpoint, loadID: this.appStateService.account.currentGraphDBLoadID }).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                        const result = response.results[index];
                        this.setGraphDBCurrentLoadStatus(result);
                        this.graphDBLoadStatus = result['payload']['overallStatus']['status'];
                        if (this.graphDBLoadStatus === 'LOAD_COMPLETED') {
                        }
                    }
                } else {
                    this.loggerService.log('Error getting Graph DB load status: ' + response.message);
                }
            }, (error) => {
                this.isGraphDBLoadStatusUpdating = false;
            }, () => {
                this.isGraphDBLoadStatusUpdating = false;
            });
        }
    }

    setGraphDBLoadStatus(data) {
        const x = $('#json-renderer-graphdb');
        (x as any).jsonViewer(data, { rootCollapsable: true });
    }

    setGraphDBCurrentLoadStatus(data) {
        const x = $('#json-renderer-graphdb-status');
        (x as any).jsonViewer(data, { rootCollapsable: true });
    }

    async loadDoc() {
        if (this.selectedNode === null) {
            this.showMessage('Select a node/edge', 'A selected node or edge should have the location of the document.');
        } else {
            if ('S3Location' in this.selectedNode) {
                let docData = {};
                const queryMessage = 'Loading Source doc...';
                const queryMainStatus = await this.statusService.setStatus(queryMessage, false);
                this.isSourceDocLoaded = false;
                this.isLoadingSourceDoc = true;

                this.appService.makeStreamingAPIPOSTCall('/getdoc', this.selectedNode).subscribe((response) => {
                    if (response.isSuccess) {
                        for (const index in response.results) {
                            docData = response.results[index];
                        }
                    } else {
                        queryMainStatus.updateStatus('Error: ' + response.message);
                    }
                }, (error) => {
                    queryMainStatus.setCompleteStatus('Source doc load completed with errors.');
                    this.loggerService.log('Error during query execution: ' + MiscUtils.getString(error));
                    this.isLoadingSourceDoc = false;
                }, () => {
                    const x = $('#json-renderer');
                    (x as any).jsonViewer(docData, { rootCollapsable: false });
                    queryMainStatus.setCompleteStatus('Source doc loaded.');
                    this.viewerLabel = 'Source Doc';
                    this.isSourceDocLoaded = true;
                    this.sourceDocURL = this.appService.getAPIAddress() + '/download-source-doc?S3Location=' + this.selectedNode['S3Location'][0];
                    this.isLoadingSourceDoc = false;
                });
            } else {
                this.showMessage('No S3 location found.', 'Could not find the location of the source document.');
            }
        }
    }

    changeEndpoint() {
        this.appUIService.showNI();
    }

    getQueryObjEndpointShortName(queryObj) {
        if ('graphDBEndpoint' in queryObj) {
            return this.appStateService.getEndpointShortName(queryObj['graphDBEndpoint']);
        } else {
            return '';
        }
    }

    getSavedQuery(queryName: string) {
        for (const index in this.savedQueries) {
            const q = this.savedQueries[index];
            if (q.queryName === queryName) {
                return q;
            }
        }
        return {};
    }

    getDefaultLabelMapping() {
        return { 'propertyName': '~label', 'index': -1, 'matchLabels': '', 'includeLabel': false };
    }

    buildQuery() {
        const queryObj = {
            id: MiscUtils.getUUID(),
            query: 'g.V().limit(10)',
            queryName: this.appStateService.account.queryName,
            appendResults: true,
            traversalDepth: 2,
            maxEdges: 10,
            queryNotes: '',
            graphDBEndpoint: this.appStateService.account.graphDBEndpoint,
            s3LoadLocation: this.appStateService.account.s3LoadLocation,
            graphDBARN: this.appStateService.account.graphDBARN,
            graphDBLoadPriority: this.appStateService.account.graphDBLoadPriority,
            queryOwner: 'Anonymous',
            allowSave: true,

            runOnNavigate: this.currentQueryObj === null ? false : this.currentQueryObj.runOnNavigate,
            nodeLabelMappings: this.currentQueryObj === null ? [this.getDefaultLabelMapping()] : this.currentQueryObj.nodeLabelMappings,
            edgeLabelMappings: this.currentQueryObj === null ? [this.getDefaultLabelMapping()] : this.currentQueryObj.edgeLabelMappings,
            learnedNodeProperties: this.currentQueryObj === null ? {} : this.currentQueryObj.learnedNodeProperties,
            learnedEdgeProperties: this.currentQueryObj === null ? {} : this.currentQueryObj.learnedEdgeProperties,

            queryResult: this.currentQueryObj === null ? {} : this.currentQueryObj.queryResult,
            queryHistory: this.currentQueryObj === null ? [] : this.currentQueryObj.queryHistory,
        };

        return queryObj;
    }

    setCurrentQuery(queryObject: any) {
        this.cancelQuery();

        this.appStateService.account.graphDBEndpoint = queryObject['graphDBEndpoint'];
        this.appStateService.account.queryName = queryObject['queryName'];
        const saved = this.getSavedQuery(queryObject['queryName']);
        MiscUtils.mergeDictionaries(saved, this.currentQueryObj);
        MiscUtils.mergeDictionaries(queryObject, this.currentQueryObj, false);

        this.updatePreviousQuery(this.currentQueryObj);

        this.setQueryNameURL(queryObject.queryName);
    }

    newQuery() {
        this.appStateService.account.queryName = this.appAccountService.getNewQueryName();
        this.currentQueryObj = null;
        this.currentQueryObj = this.buildQuery();
    }

    saveCurrentQuery() {
        for (const index in this.savedQueries) {
            const q = this.savedQueries[index];
            if (this.appStateService.account.queryName === q.queryName) {
                if (q['queryOwner'] == '' || q['queryOwner'] == 'Anonymous') {

                } else {
                    if (q['queryOwner'] == this.appStateService.account.name) {

                    } else {
                        if (q['allowSave']) {

                        } else {
                            this.showMessage('Query is owned', 'The query is owned by \'' + q['queryOwner'] + '\' and has been flagged as unmodifiable. To save your query, simply give it a unique name and then save it.');
                            return;
                        }
                    }
                }

                if (this.appStateService.account.confirmSaveQuery) {
                    this.showMessage('Overwrite Existing?', 'There is a query present with the name \'' + q.queryName + '\' Are you sure you want to overwrite it?', true, () => { this.saveQuery(); });
                } else {
                    this.saveQuery();
                }
                return;
            }
        }

        const newQ = this.buildQuery();
        MiscUtils.mergeDictionaries(this.currentQueryObj, newQ);
        newQ['queryName'] = this.appStateService.account.queryName;
        if (this.appStateService.account.isAnonymous) {
        } else {
            if (newQ['queryOwner'] == '' || newQ['queryOwner'] == 'Anonymous') {
                newQ['queryOwner'] = this.appStateService.account.name;
            }
        }
        this.savedQueries.push(newQ);
        this.currentQueryObj = newQ;
        this.saveQuery();
    }

    async saveQuery() {
        if (this.isSavingQuery) {

        } else {
            this.isSavingQuery = true;
            const queryObj = this.getCurrentQueryObj();
            queryObj['id'] = MiscUtils.getUUID();
            this.updatePreviousQuery(queryObj);
            const status = await this.statusService.setStatus('Saving query...');
            return this.appService.makeAPIPutCall('/graphdb-saved-query', queryObj).subscribe((response) => {
                for (const index in response.responses) {
                    const r = response.responses[index];
                    for (const index in r.results) {
                        const result = r.results[index];
                        status.updateStatus(r.message);
                        this.loggerService.log(MiscUtils.getString(result));
                    }
                }
            }, (error) => {
                status.setErrorStatus(MiscUtils.getString(error));
                this.isSavingQuery = false;
            }, () => {
                this.isSavingQuery = false;
                status.setCompleteStatus('Done saving Graph DB query.');
                this.mqttPublish(this.addGraphDBQueryTopic, JSON.stringify(queryObj));
                this.loggerService.log('Notified other connected clients of changes.');
            });
        }
    }

    overrideQueryOwner() {
        if (!this.appStateService.account.isAnnonymous) {
            this.currentQueryObj['queryOwner'] = this.appStateService.account.name;
        }
    }

    getCurrentQueryObj() {
        // for now, always use the selected graph db endpoint
        this.currentQueryObj['graphDBEndpoint'] = this.appStateService.account.graphDBEndpoint;
        return this.currentQueryObj;
    }

    async createQueryDownload(queryName: string = null, runAllHistoryForDownload: boolean = false) {
        let qName = queryName;
        let queryObj = null;
        if (qName === null) {
            qName = this.appStateService.account.queryName;
            queryObj = this.getCurrentQueryObj();
        } else {
            if (this.doesSavedQueryExist(qName)) {
                queryObj = this.getSavedQuery(qName);
            } else {
                this.showMessage('Select query', 'Please choose a saved query for download.');
                return;
            }
        }
        queryObj['runAllHistoryForDownload'] = runAllHistoryForDownload;

        const status = await this.statusService.setStatus('Creating query download...', false);
        this.loggerService.log('Creating query download for query \'' + qName + '\'...');
        this.appService.makeAPIPutCall('/graphdb-download', queryObj).subscribe((response) => {
            for (const index in response.responses) {
                const r = response.responses[index];
                for (const index in r.results) {
                    const result = r.results[index];
                    status.updateStatus(r.message);
                    this.loggerService.log(MiscUtils.getString(result));
                    let historyMessage = '';
                    if (runAllHistoryForDownload) {
                        historyMessage = '<br/>Because this downloads all historical queries for this query, each query is run and streamed as part of the download.';
                    }
                    this.showMessage('Your download has been created.', '<div style=\'font-size: 0.8em\'>The URL for your download is:<br/><br/><a href=\'' + this.appService.getAPIAddress() + '/graphdb-get-download?id=' + result.id + '\' download>' + this.appService.getAPIAddress() + '/graphdb-get-download?id=' + result.id + '</a><br/><br/>Note: when downloads are created, they store the current query and are executed when downloaded. The above URL will always run the same query despite any subsequent changes to the query. Any changes to the query would require that a new download be created. Any number of downloads can be created for any query. ' + historyMessage + '</div>');
                }
            }
        }, (error) => {
            status.setErrorStatus('Error creating download: ' + MiscUtils.getString(error));
            this.loggerService.log('Error creating query download for \'' + qName + '\'.');
        }, () => {
            this.loggerService.log('Done creating query download for \'' + qName + '\'.');
            status.setCompleteStatus('Done creating download.');
        });
    }

    promptDeleteQuery(queryObj) {
        this.showMessage('Are you sure?', 'Please confirm you want to delete this query.', true, () => { this.deleteQuery(queryObj); });
    }

    async deleteQuery(queryObj: any) {
        const status = await this.statusService.setStatus('Deleting query...');
        this.appService.makeAPIPostCall('/delete-graphdb-saved-query', queryObj).subscribe((response) => {
            // status.updateStatus(result);
        }, (error) => {
            status.setErrorStatus(MiscUtils.getString(error));
        }, () => {
            status.setCompleteStatus('Done deleting Graph DB query.');
            const oldq = this.savedQueries;
            this.savedQueries = [];
            for (const index in oldq) {
                const o = oldq[index];
                if (o === queryObj) {

                } else {
                    this.savedQueries.push(o);
                }
            }
            this.mqttPublish(this.deleteGraphDBQueryTopic, JSON.stringify(queryObj));
            this.loggerService.log('Notified other connected clients of query deletion.');
        });
    }

    sanitizeQueryObj(queryObj: any) {
        const correctQueryObj = this.buildQuery();
        const queryName = queryObj['queryName'];
        if ('queryHistory' in queryObj) {
            const queryObjH = queryObj['queryHistory'];
            for (const index in queryObjH) {
                const queryObjHistory = queryObjH[index];
                this.sanitizeQueryObjHistory(queryObjHistory, queryName);
            }
        }
        if ('nodeLabelMappings' in queryObj) {
            this.sanitizeLabelMappings(queryObj['nodeLabelMappings']);
        }
        if ('edgeLabelMappings' in queryObj) {
            this.sanitizeLabelMappings(queryObj['edgeLabelMappings']);
        }
        MiscUtils.mergeDictionaries(queryObj, correctQueryObj, false);
        MiscUtils.mergeDictionaries(correctQueryObj, queryObj, false);

    }

    sanitizeLabelMappings(labelMappings) {
        for (const key in labelMappings) {
            const labelMapping = labelMappings[key];
            const defaultMapping = this.getDefaultLabelMapping();
            MiscUtils.mergeDictionaries(labelMapping, defaultMapping, false);
            labelMappings[key] = defaultMapping;
        }
    }

    sanitizeQueryObjHistory(queryObjHistory, queryName) {
        queryObjHistory['queryName'] = queryName;
        for (const key in queryObjHistory) {
            const val = queryObjHistory[key];
            if (Array.isArray(val)) {
                delete queryObjHistory[key];
            } else if (val instanceof Object) {
                if (key != 'queryResult') {
                    delete queryObjHistory[key];
                }
            }
        }
    }

    async loadSavedQueries() {
        this.savedQueries = [];
        const queryMessage = 'Loading saved queries...';
        this.loggerService.log(queryMessage);
        const queryMainStatus = await this.statusService.setStatus(queryMessage, false);

        return new Promise<void>((resolve, reject) => {
            return this.appService.makeStreamingAPIPOSTCall('/graphdb-saved-queries', {}).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                        const result = response.results[index];
                        const newObj = JSON.parse(result['query']);
                        const queryObj = this.buildQuery();
                        MiscUtils.mergeDictionaries(newObj, queryObj, false);
                        this.sanitizeQueryObj(queryObj);
                        this.savedQueries.push(queryObj);
                    }
                } else {
                    queryMainStatus.updateStatus('Error: ' + response.message);
                }
            }, (error) => {
                queryMainStatus.setCompleteStatus('Query completed with errors.');
                this.loggerService.log('Error during query execution: ' + MiscUtils.getString(error));
                resolve();
            }, () => {
                this.loggerService.log('Done loading saved queries.');
                queryMainStatus.setCompleteStatus('Loading saved queries is complete.');
                resolve();
            });
        });
    }

    runNodeQuery(node) {
        let query = '';
        if ('~inV' in node && '~outV' in node) {
            query = 'g.E(\'' + node['~id'] + '\').limit(' + this.appStateService.account.uiMaxEdges.toString() + ')';
        } else {
            query = 'g.V(\'' + node['~id'] + '\')';
        }
        const queryObj = {};
        queryObj['query'] = query;
        queryObj['traversalDepth'] = 1;
        queryObj['maxEdges'] = this.appStateService.account.uiMaxEdges;
        queryObj['appendResults'] = true;
        this.executeQuery(queryObj);
    }

    areQueriesTheSame(queryObj1, queryObj2) {
        if (queryObj1 === null || queryObj2 === null) {
            return null;
        }

        for (const keyIndex in this.queryObjFields) {
            const key = this.queryObjFields[keyIndex];
            if (queryObj1[key] === queryObj2[key]) {
                continue;
            } else {
                return false;
            }
        }
        return true;
    }

    addQueryToHistoryAndSetResults(queryObj) {
        let found = false;
        let currentQueryObj = this.getCurrentQueryObj();
        for (const index in currentQueryObj.queryHistory) {
            const q = currentQueryObj.queryHistory[index];
            if (this.areQueriesTheSame(q, queryObj)) {
                found = true;
                let result = {};
                MiscUtils.mergeDictionaries(queryObj.queryResult, result);
                q.queryResult = result; //queryObj.queryResult;
            }
        }
        if (found) {
        } else {
            currentQueryObj.queryHistory.push(queryObj);
        }
    }

    deleteHistoryQuery(queryObj) {
        const history = [];
        let currentQueryObj = this.getCurrentQueryObj();
        for (const index in currentQueryObj.queryHistory) {
            const q = currentQueryObj.queryHistory[index];
            if (q === queryObj) {
            } else {
                history.push(q);
            }
        }
        currentQueryObj.queryHistory = history;
    }

    runQuery() {
        const queryObj = this.getCurrentQueryObj();
        if (this.appStateService.account.showGraphEdgeWarningMessage) {
            if (this.doesQueryContainExpensiveEdgeQuery()) {
                this.showMessage('Warning', 'This query contains the inE(), bothE() or path() iterators.', true, () => { this.executeQuery(); });
            } else {
                this.executeQuery(queryObj);
            }
        } else {
            this.executeQuery(queryObj);
        }
    }

    showQueryMessage() {
        this.showMessage('Patience!', 'Please wait while the last query finishes, or cancel it before running another.');
    }

    async runAllHistory() {
        if (this.isQueryRunning) {
            this.showQueryMessage();
        } else {
            let currentIndex = 0;
            const statusObj = await this.statusService.setStatus('Running all history now...');
            this.isRunningAllHistory = true;
            const history = this.currentQueryObj.queryHistory;
            const thisSubscription = timer(300, 300).subscribe(() => {
                if (this.isRunningAllHistory) {
                    if (currentIndex < history.length) {
                        if (this.isQueryRunning) {
                        } else {
                            this.autoSave();
                            const q = history[currentIndex];
                            this.executeQuery(q, true, false);
                            currentIndex++;
                        }
                    } else {
                        if (this.isQueryRunning) {

                        } else {
                            thisSubscription.unsubscribe();
                            this.isRunningAllHistory = false;
                            statusObj.setCompleteStatus('Finished running all history.');
                            if (this.appStateService.account.switchToGraphOnQueryRun) {
                                this.selectTab(this.queryTabs, 0);
                            }
                        }
                    }
                } else {
                    thisSubscription.unsubscribe();
                    statusObj.setCompleteStatus('Cancelled running all history.');
                }
            });
        }
    }

    updateQueryResult(queryResult, update) {
        const keys = Object.keys(queryResult);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (key in update) {
                queryResult[key] = update[key];
            }
        }
        MiscUtils.mergeDictionaries(update, queryResult);
    }

    async executeQuery(queryObject = null, ignoreAppend = false, showNonEdgeOrNodeMessage = true) {
        this.queryCount++;
        this.graph2DFirstZoom = true;
        this.graph3DFirstZoom = true;
        let queryObj = queryObject;
        if (this.isQueryRunning) {
            this.showQueryMessage();
        } else {
            if (queryObj === null) {
                queryObj = this.currentQueryObj;
            }

            let prevQueryObj = queryObj;
            const q = this.buildQuery();
            MiscUtils.mergeDictionaries(this.getCurrentQueryObj(), q);
            MiscUtils.mergeDictionaries(queryObj, q);
            this.sanitizeQueryObjHistory(q, q['queryName']);
            queryObj = q;

            this.addQueryToHistoryAndSetResults(queryObj);
            MiscUtils.mergeDictionaries(q, this.currentRunningQueryObj);

            this.isQueryRunning = true;
            this.queryHadErrors = false;
            this.queryResultCount = 0;
            this.queryStatus = 'Running...';
            this.queryError = 'No error.';
            this.currentEdges = 0;
            this.currentNodes = 0;
            const queryMessage = 'Running query \'' + queryObj.query + '\' with a traversal depth of ' + queryObj.traversalDepth.toString() + '...';
            // this.loggerService.log(queryMessage);
            this.queryMainStatus = await this.statusService.setStatus(queryMessage);
            this.queryDownloadStatus = await this.statusService.setStatus('Downlading results...');

            let shouldAdd = true;

            if (queryObj['appendResults']) {
            } else {
                if (ignoreAppend) {
                    shouldAdd = false;
                } else {
                    this.resetResults();
                    this.resetGraphs();
                }
            }

            this.runningQuery = queryObj['query'];
            this.runningTraversalDepth = queryObj['traversalDepth'];
            this.runningMaxEdges = queryObj['maxEdges'];
            this.runningAppendResults = queryObj['appendResults'];

            // for now, always use the selected graph db endpoint
            queryObj['graphDBEndpoint'] = this.appStateService.account.graphDBEndpoint;

            this.querySubscription = this.appService.makeStreamingAPIPOSTCall('/graphdb-query', queryObj).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                        const result = response.results[index];
                        let isNodeOrEdge = true;
                        this.updateQueryResult(queryObj.queryResult, { N: this.currentNodes, E: this.currentEdges });
                        prevQueryObj.queryResult = { N: this.currentNodes, E: this.currentEdges };
                        if ('edge' in result) {
                            const obj = result['edge'];
                            if (shouldAdd) {
                                this.addEdge(obj);
                            }
                            this.learnEdgeProperties(obj);
                        } else if ('node' in result) {
                            const obj = result['node'];
                            if (shouldAdd) {
                                this.addNode(obj);
                            }
                            this.learnNodeProperties(obj);
                        } else {
                            isNodeOrEdge = false;
                            this.updateQueryResult(queryObj.queryResult, result);
                        }

                        if (!isNodeOrEdge) {
                            this.loggerService.log('Result is neither a node or an edge: ' + MiscUtils.getString(result, 4));
                        }

                        this.queryResultCount++;
                        this.queryDownloadStatus.updateStatus('Downloading results: ' + this.queryResultCount.toString() + '...');
                        if (isNodeOrEdge) {
                            if (this.queryResultCount % this.appStateService.account.loadGraphIncrement == 0) {
                                if (this.appStateService.account.loadGraphWhileStreaming) {
                                    this.loadSelectedGraphs(true);
                                }
                            }
                        } else {
                            if (this.appStateService.account.showNonEdgeOrNodeMessage && showNonEdgeOrNodeMessage) {
                                if (this.queryCount > 1) {
                                    this.showMessage('Not node or edge', 'One or more of the results was not a node or edge. The resulting value is below. See the console output for any other values returned.<div>' + MiscUtils.getString(result, 4) + '</div>');
                                }
                            }
                        }
                    }
                } else {
                    this.queryMainStatus.updateStatus('Error: ' + response.message);
                    if (this.appStateService.account.showQueryErrorMessageBox) {
                        this.showMessage('Error: ' + response.message, response.errorDetail);
                    } else {
                        this.loggerService.log('Query had an error: ' + response.message + ' - to see more details, turn on the error message box in the options tab.');
                    }
                    this.queryHadErrors = true;
                    this.queryError = response.message;
                }
            }, (error) => {
                this.queryMainStatus.setCompleteStatus('Query completed with errors.');
                this.queryDownloadStatus.setErrorStatus('Failed to download results.');
                this.loggerService.log('Error during query execution: ' + MiscUtils.getString(error));
                this.queryHadErrors = true;
                this.isQueryRunning = false;
                this.querySubscription = null;
                this.queryStatus = 'Request failed.';
                this.queryError = MiscUtils.getString(error);
            }, () => {
                this.lastQueryID = MiscUtils.getUUID();
                this.queryMainStatus.setCompleteStatus('Query complete.');
                this.queryDownloadStatus.setCompleteStatus('Total results downloaded: ' + this.queryResultCount.toString() + '.');
                this.isQueryRunning = false;
                this.querySubscription = null;
                if (this.isRunningAllHistory) {
                } else {
                    if (this.appStateService.account.switchToGraphOnQueryRun) {
                        this.selectTab(this.queryTabs, 0);
                    }
                }
                this.loadSelectedGraphs();
                this.queryStatus = 'Complete.';
            });
        }
    }

    cloneQueryObj(queryObj) {
        const x = {};
        MiscUtils.mergeDictionaries(queryObj, x, false);
        this.currentQueryObj.queryHistory.push(x);
    }

    async profileAndExplainQuery(query: string = null) {
        if (this.isExplaining) {
            this.showMessage('Please wait', 'Please wait for the last explain request to finish.');
        } else {
            this.selectTab(this.queryTabs, 5);
            let queryMessage = 'Running explain on \'' + this.getCurrentQueryObj().query + '\'...';
            this.loggerService.log(queryMessage);
            const explainStatus = await this.statusService.setStatus(queryMessage, false);
            const data = this.getCurrentQueryObj();
            let isThisProfiling: boolean = true;
            let isThisExplaining: boolean = true;
            this.isExplaining = true;

            this.querySubscription = this.appService.makeStreamingAPIPOSTCall('/explain-query', data).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                        const result = response.results[index];
                        this.queryExplain = result['explain'];
                    }
                } else {
                    explainStatus.updateStatus('Error explaining query: ' + response.message);
                    this.loggerService.log('Explain request had an error: ' + response.message);
                }
            }, (error) => {
                explainStatus.setCompleteStatus('Query explain completed with errors.');
                this.loggerService.log('Error during query explain: ' + MiscUtils.getString(error));
                isThisExplaining = false;
                this.updateIsThisExplaining(isThisExplaining, isThisProfiling);
            }, () => {
                let queryMessage = 'Done running explain on \'' + this.getCurrentQueryObj().query + '\'.';
                this.loggerService.log(queryMessage);
                explainStatus.setCompleteStatus('Explain complete.');
                isThisExplaining = false;
                this.updateIsThisExplaining(isThisExplaining, isThisProfiling);
            });

            queryMessage = 'Running profile on \'' + this.currentQueryObj.query + '\'...';
            this.loggerService.log(queryMessage);
            const profileStatus = await this.statusService.setStatus(queryMessage, false);

            this.querySubscription = this.appService.makeStreamingAPIPOSTCall('/profile-query', data).subscribe((response) => {
                if (response.isSuccess) {
                    for (const index in response.results) {
                        const result = response.results[index];
                        this.queryProfile = JSON.stringify(result['profile'], null, 4);
                    }
                } else {
                    profileStatus.updateStatus('Error profiling query: ' + response.message);
                    this.loggerService.log('Profile request had an error: ' + response.message);
                }
            }, (error) => {
                profileStatus.setCompleteStatus('Query profile completed with errors.');
                this.loggerService.log('Error during query profile: ' + MiscUtils.getString(error));
                isThisProfiling = false;
                this.updateIsThisExplaining(isThisExplaining, isThisProfiling);
            }, () => {
                profileStatus.setCompleteStatus('Profile complete.');
                queryMessage = 'Done running profile on \'' + this.currentQueryObj.query + '\'.';
                this.loggerService.log(queryMessage);
                isThisProfiling = false;
                this.updateIsThisExplaining(isThisExplaining, isThisProfiling);
            });
        }
    }

    updateIsThisExplaining(explaining = true, profiling = true) {
        if (explaining || profiling) {
            this.isExplaining = true;
        } else {
            this.isExplaining = false;
        }
    }

    cancelQuery() {
        if (this.querySubscription === null) {

        } else {
            this.lastQueryID = MiscUtils.getUUID();
            this.querySubscription.unsubscribe();
            this.isQueryRunning = false;
            this.isRunningAllHistory = false;
            this.queryStatus = 'Cancelled.';
            this.querySubscription = null;
            this.queryMainStatus.setCompleteStatus('Query cancelled.');
            this.queryDownloadStatus.setCompleteStatus('Total results downloaded: ' + this.queryResultCount.toString() + '.');
        }
    }

    cancelRunAllHistory() {
        this.cancelQuery();
    }

    resetResults() {
        this.nodes = {};
        this.edges = {};
        this.nodesArray = [];
        this.edgesArray = [];
        this.totalEdges = 0;
        this.totalNodes = 0;
        this.currentEdges = 0;
        this.currentNodes = 0;
        this.queryStatus = '';
        this.queryError = '';

        this.resetResultsTable();
    }

    resetResultsTable() {
        let myNode = this.resultsTableNodes.nativeElement;
        while (myNode.firstChild) {
            myNode.removeChild(myNode.firstChild);
        }
        myNode = this.resultsTableEdges.nativeElement;
        while (myNode.firstChild) {
            myNode.removeChild(myNode.firstChild);
        }
    }

    addNodeToResultsTable(node, table) {
        this.addToResultsTable(node, table, this.getNodeLabel(node));
    }

    addEdgeToResultsTable(edge, table) {
        this.addToResultsTable(edge, table, this.getEdgeLabel(edge));
    }

    addToResultsTable(obj, table, label) {
        const newTR = document.createElement('TR');
        const newTD1 = document.createElement('TD');
        const newTD2 = document.createElement('TD');

        let childText = document.createTextNode(label);
        newTD1.appendChild(childText);

        childText = document.createTextNode(JSON.stringify(obj));
        newTD2.appendChild(childText);

        newTR.appendChild(newTD1);
        newTR.appendChild(newTD2);

        newTR.oncontextmenu = () => this.rightClick(obj);
        newTR.onclick = () => this.leftClick(obj);
        newTR.classList.add('resultsTable');

        table.appendChild(newTR);
    }

    addNode(node) {
        const nodeID = node['~id'];
        var wasAdded = false;
        if (nodeID in this.nodes) {
        } else {
            this.nodes[nodeID] = node;
            this.nodesArray.push(node);
            this.totalNodes++;
            wasAdded = true;
        }
        this.currentNodes++;
        if (this.appStateService.account.loadResultsTable) {
            this.addNodeToResultsTable(node, this.resultsTableNodes.nativeElement);
        }
        return wasAdded;
    }

    addEdge(edge) {
        const edgeID = edge['~id'];
        var wasAdded = false;
        if (edgeID in this.edges) {
        } else {
            this.edges[edgeID] = edge;
            this.edgesArray.push(edge);
            this.totalEdges++;
            wasAdded = true;
        }
        this.currentEdges++;
        if (this.appStateService.account.loadResultsTable) {
            this.addEdgeToResultsTable(edge, this.resultsTableEdges.nativeElement);
        }
        return wasAdded;
    }

    learnEdgeProperties(obj) {
        this.learnProperties(obj, this.currentQueryObj.learnedEdgeProperties);
    }

    learnNodeProperties(obj) {
        this.learnProperties(obj, this.currentQueryObj.learnedNodeProperties);
    }

    learnProperties(obj, learnedPropertiesDict: any) {
        let labels = [];
        if ('~label' in obj) {
            const labelTest = obj['~label'];
            if (Array.isArray(labelTest)) {
                labels = labelTest;
            } else {
                labels = [labelTest.toString()];
            }

        }
        for (const key in obj) {
            if (key === '~label') {
            } else {
                let learnedLabels = {};
                if (key in learnedPropertiesDict) {
                    learnedLabels = learnedPropertiesDict[key];
                } else {
                    learnedPropertiesDict[key] = learnedLabels;
                }
                for (let i = 0; i < labels.length; i++) {
                    const label = labels[i];
                    if (label in learnedLabels) {

                    } else {
                        learnedLabels[label] = '';
                    }
                }
            }
        }
    }

    removeNodeLabelMapping(labelMapping) {
        this.currentQueryObj.nodeLabelMappings = this.removeLabelMapping(labelMapping, this.currentQueryObj.nodeLabelMappings);
    }

    removeEdgeLabelMapping(labelMapping) {
        this.currentQueryObj.edgeLabelMappings = this.removeLabelMapping(labelMapping, this.currentQueryObj.edgeLabelMappings);
    }

    removeLabelMapping(labelMapping, labelMappings) {
        const newMapping = [];
        for (let i = 0; i < labelMappings.length; i++) {
            if (labelMapping == labelMappings[i]) {

            } else {
                newMapping.push(labelMappings[i]);
            }
        }
        return newMapping;
    }

    addNodeLabelMappingFromLearned(propName: string) {
        this.addLabelMappingFromLearned(propName, this.currentQueryObj.nodeLabelMappings);
    }

    addEdgeLabelMappingFromLearned(propName: string) {
        this.addLabelMappingFromLearned(propName, this.currentQueryObj.edgeLabelMappings);
    }

    addLabelMappingFromLearned(propName: string, destMapping: any[]) {
        const mapping = { propertyName: propName, index: -1, matchLabels: '', includeLabel: true };
        destMapping.unshift(mapping);
    }

    getNodeLabel(obj) {
        return this.getLabel(obj, this.currentQueryObj.nodeLabelMappings);
    }

    getEdgeLabel(obj) {
        return this.getLabel(obj, this.currentQueryObj.edgeLabelMappings);
    }

    getLabel(obj: any, labelPriorities: any[]) {
        let label = 'NoLabelSet';
        let label0 = '';

        if ('~label' in obj) {
            try {
                label = obj['~label'].toString();
                if (Array.isArray(obj['~label'])) {
                    label0 = obj['~label'][0].toString();
                } else {
                    label0 = obj['~label'].toString();
                }
            } catch (e) { }
        }

        this.ensureDefaultLabelPropertiesExists(labelPriorities);

        for (let i = 0; i < labelPriorities.length; i++) {
            const labelPriority = labelPriorities[i];
            let found = false;
            const key = labelPriority['propertyName'];
            if (key in obj) {
                const index = labelPriority['index'];
                const matchLabelsStr = labelPriority['matchLabels'];
                const matchLabelsArray = matchLabelsStr.split(',');
                const matchLabels = {};
                if (matchLabelsArray.length > 0 && matchLabelsStr != '') {
                    if ('~label' in obj) {
                        for (let x = 0; x < matchLabelsArray.length; x++) {
                            matchLabels[matchLabelsArray[x]] = '';
                        }
                        let objLabel = obj['~label'];
                        if (!Array.isArray(objLabel)) {
                            objLabel = [objLabel.toString()];
                        }
                        let matchKeyFound = false;
                        for (const matchLabelKey in matchLabels) {
                            if (objLabel.indexOf(matchLabelKey) < 0) {
                                continue;
                            } else {
                                matchKeyFound = true;
                                break;
                            }
                        }
                        if (!matchKeyFound) {
                            continue;
                        }
                    }
                }
                if (index >= 0) {
                    try {
                        label = obj[key][index].toString();
                        found = true;
                    } catch (e) {
                        label = obj[key].toString();
                        found = true;
                    }
                } else {
                    label = obj[key].toString();
                    found = true;
                }
            }
            if (found) {
                if (labelPriority['includeLabel']) {
                    if (label0 != '') {
                        label = label0 + ': ' + label;
                    }
                }
                break;
            }
        }
        return label;
    }

    ensureDefaultLabelPropertiesExists(labelPriorities: any[]) {
        if (labelPriorities.length > 0) {
            const labelPriority = labelPriorities[labelPriorities.length - 1];
            if (labelPriority['propertyName'] === '~label' && labelPriority['index'] === -1 && labelPriority['matchLabels'] === '') {
                return;
            }
        }
        labelPriorities.push(this.getDefaultLabelMapping());
    }

    stringify(obj: any) {
        return JSON.stringify(obj);
    }

    highlightNode(node) {
        this.highlightedNode = node;
    }

    selectNode(nodeToSelect) {
        const node = this.filterNode(nodeToSelect);
        this.selectedNode = node;
        const nodeID = node['~id'];
        this.viewerLabel = node['~label'].toString();
        let type = 'node';
        if ('~outV' in node && '~inV' in node) {
            type = 'edge';
            if ('source' in node) {
                if ('S3Location' in node['source']) {
                    node['S3Location'] = node['source']['S3Location'][0];
                }
            } else if ('target' in node) {
                if ('S3Location' in node['source']) {
                    node['S3Location'] = node['source']['S3Location'][0];
                }
            }
            this.viewerLabel + ' (edge)';
            const id = node['~label'][0].toString();
            this.viewerID = id;
        } else if ('S3Location' in node) {
            this.viewerLabel + ' (node)';
            const location = node['S3Location'][0];
            const arr = location.split('/');
            const id = arr[arr.length - 1];
            this.viewerID = id;
        } else {
            this.viewerID = '';
        }
        this.loggerService.log('Loading ' + type + ' \'' + nodeID + '\'...');
        const x = $('#json-renderer');
        (x as any).jsonViewer(node, { rootCollapsable: false });
        this.loggerService.log('Successfully loaded ' + type + '.');
        this.isSourceDocLoaded = false;
    }

    setQueryNameURL(queryName: string = null) {
        let q = queryName;
        if (q === null) {
            q = this.appStateService.account.queryName;
        }
        const queryParams: Params = { queryName: q };

        this.router.navigate([], { relativeTo: this.activatedRoute, queryParams: queryParams, queryParamsHandling: 'merge' });
    }

    setQueryFromURL(showMessage = false) {
        if ('queryName' in this.activatedRoute.snapshot.queryParams) {
            const q = this.activatedRoute.snapshot.queryParams['queryName'];
            if (this.doesSavedQueryExist(q)) {
                this.loggerService.log('Loading query \'' + q + '\' based on URL query param.');
                const queryObj = this.getSavedQuery(q);
                this.setCurrentQuery(queryObj);
                if (queryObj.runOnNavigate) {
                    this.executeQuery();
                }
                this.loggerService.log('Done loading saved query based on URL param.');
            } else {
                if (showMessage) {
                    this.showMessage('Query not found', 'The query specified in the URL cannot be found.');
                }
                return false;
            }
        } else {
            return false;
        }
        return true;
    }

    doesURLHaveQuery() {
        if ('queryName' in this.activatedRoute.snapshot.queryParams) {
            return true;
        }
        return false;
    }

    filterNode(node: any) {
        const newNode: any = {};
        MiscUtils.mergeDictionaries(node, newNode, false);
        const keysToRemove = {
            '~traverseLevel': null,
            '~maxTraverseLevel': null,
            '__indexColor': null,
            'color': null,
            'index': null,
            'x': null,
            'y': null,
            'z': null,
            'vx': null,
            'vy': null,
            'vz': null,
            'fx': null,
            'fy': null,
            'fz': null,
            '__threeObj': null,
            '__proto__': null,
            '__curve': null,
            '__lineObj': null,
        };

        for (const key in keysToRemove) {
            if (key in newNode) {
                delete newNode[key];
            }
        }

        if ('source' in newNode) {
            newNode['source'] = this.filterNode(newNode['source']);
        }
        if ('target' in newNode) {
            newNode['target'] = this.filterNode(newNode['target']);
        }

        return newNode;
    }

    filterNodeForLoad(node: any) {
        const newNode = {};
        MiscUtils.mergeDictionaries(node, newNode, false);
        const keysToRemove = {
            /*
                  "~traverseLevel": null,
                  "~maxTraverseLevel": null,
                  "__indexColor": null,
                  "color": null,
                  "index": null,
                  "x": null,
                  "y": null,
                  "z": null,
                  "vx": null,
                  "vy": null,
                  "vz": null,
                  "fx": null,
                  "fy": null,
                  "fz": null,
            */
            '__threeObj': null,
            '__proto__': null,
        };

        for (const key in keysToRemove) {
            if (key in newNode) {
                delete newNode[key];
            }
        }

        return newNode;
    }

    getKeys(obj) {
        return Object.keys(obj);
    }

    onKeydown(event) {
        if (event.key === "Enter") {
            this.runQuery();
        }
    }
}

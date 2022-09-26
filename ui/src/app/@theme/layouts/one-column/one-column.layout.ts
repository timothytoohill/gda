import { Component, ViewChild, ElementRef, DoCheck, OnDestroy } from '@angular/core';
import { LayoutService } from '../../../@core/utils/layout.service';
import { timer, Observable, Subscription } from 'rxjs';

@Component({
    selector: 'ngx-one-column-layout',
    styleUrls: ['./one-column.layout.scss'],
    template: `
    <nb-layout windowMode>
      <nb-layout-header fixed>
        <div #headerContainer class="headerMod">
          <ngx-header></ngx-header>
        </div>
      </nb-layout-header>

      <nb-sidebar class="menu-sidebar" tag="menu-sidebar" responsive>
        <ng-content select="nb-menu"></ng-content>
      </nb-sidebar>

      <nb-layout-column>
        <div #layoutContainer class="layoutMod">
          <ng-content select="router-outlet"></ng-content>
        </div>
      </nb-layout-column>

<!--
      <nb-layout-column>
        <ng-content select="router-outlet"></ng-content>
      </nb-layout-column>
-->
      <nb-layout-footer fixed>
        <div #footerContainer class="footerMod">
          <ngx-footer></ngx-footer>
        </div>
      </nb-layout-footer>
    </nb-layout>
  `,
})
export class OneColumnLayoutComponent implements DoCheck, OnDestroy {
    @ViewChild('layoutContainer', { static: false }) private layoutContainer: ElementRef;
    @ViewChild('footerContainer', { static: false }) private footerContainer: ElementRef;
    private footerParentComputedStyle; // = window.getComputedStyle(this.footerContainer.nativeElement);
    private bottomPad: number = 15;

    private updateDelay: number = 300;
    private lastUpdate: number = 0;
    private updateTimer: Observable<any> = null;
    private updateTimerSubscription: Subscription = null;
    private needsUpdate: boolean = false;

    constructor(private layoutService: LayoutService) {
        this.updateTimer = timer(this.updateDelay, this.updateDelay);
        this.updateTimerSubscription = this.updateTimer.subscribe(() => {
            this.updateSize();
        });
    }

    ngOnDestroy() {
        if (this.updateTimerSubscription === null) {

        } else {
            this.updateTimerSubscription.unsubscribe();
        }
    }

    ngDoCheck() {
        const nowDT = Date.now();
        if (nowDT - this.lastUpdate > this.updateDelay) {
            this.needsUpdate = true;
            this.lastUpdate = nowDT;
        }
    }

    private updateSize() {
        if (this.needsUpdate) {
            this.needsUpdate = false;
            if (this.layoutContainer && this.footerContainer) {
                const offsets = this.layoutContainer.nativeElement.getBoundingClientRect();
                this.footerParentComputedStyle = window.getComputedStyle(this.footerContainer.nativeElement.parentNode);
                const footerHeight = parseInt(this.footerParentComputedStyle.height.replace('px', ''));
                this.layoutContainer.nativeElement.style.height = (window.innerHeight - offsets.top - footerHeight - this.bottomPad).toString() + 'px';
            }
        }
    }
}

import { Component, ViewChild, ElementRef } from '@angular/core';

@Component({ selector: '[scrollable-container]', templateUrl: 'scrollable.container.component.html', styleUrls: ['scrollable.container.component.scss'] })
export class ScrollableContainerComponent {
    @ViewChild('itemContainer', { static: false }) private container: ElementRef;

    scrollToBottom() {
        this.container.nativeElement.scrollTop = this.container.nativeElement.scrollHeight;
    }
}

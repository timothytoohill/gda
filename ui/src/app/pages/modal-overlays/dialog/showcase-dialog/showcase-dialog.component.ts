import { Component, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
    selector: 'ngx-showcase-dialog',
    templateUrl: 'showcase-dialog.component.html',
    styleUrls: ['showcase-dialog.component.scss'],
})
export class ShowcaseDialogComponent {

    @Input() title: string = '';
    @Input() message: string = '';
    @Input() showCancel: boolean = false;
    @Input() okCallback: any = null;
    @Input() cancelCallback: any = null;

    constructor(protected ref: NbDialogRef<ShowcaseDialogComponent>) { }

    dismiss() {
        this.ref.close();
        if (this.okCallback !== null)
            this.okCallback();
    }

    cancel() {
        this.ref.close();
        if (this.cancelCallback !== null)
            this.cancelCallback();
    }

}

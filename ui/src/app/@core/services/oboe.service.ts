import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

declare var oboe: any;

@Injectable()
export class OboeService {
    constructor() {}

    public get(url, pattern = '!') {
        return this.useOboe(url, pattern);
    }

    public post(url, pattern, data) {
        return this.useOboe(url, pattern, 'POST', data);
    }

    private useOboe(url, pattern, method = 'GET', body: any = null) {
        const config = {
            url: url,
            method: method,
        };
        if (body != null) {
            config['body'] = body;
        }

        return Observable.create((subscriber) => {
            const oboeObj = oboe(config).start((status, headers) => {
                if (status < 200 || status >= 300) {
                    oboeObj.abort();
                    subscriber.error(status, headers);
                }
            }).fail((error) => {
                subscriber.error(error);
            }).node(pattern, (node) => {
                subscriber.next(node);
                // Oboe.drop signals that memory for the current node can be reclaimed
                return oboeObj.drop;
            }).done((data) => {
                subscriber.complete();
                return oboeObj.drop;
            });

            // we abort fetching more data when somebody unsubscribes from observable
            return () => oboeObj.abort();
        });
    }
}

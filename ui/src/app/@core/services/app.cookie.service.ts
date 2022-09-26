import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { AppStateService, AppConfigurations } from './app.state.service';
import { AppService } from './app.service';
import { LoggerService } from './logger.service';
import { StatusService } from './status.service';
import { MiscUtils } from '../utils/miscutils';

@Injectable()
export class AppCookieService {
    private baseTime: number = 1575855427205;
    private path: string = ';path=/';

    constructor(private appService: AppService, private statusService: StatusService, private appStateService: AppStateService, private loggerService: LoggerService) {
    }

    public setCookie(cname, cvalue, exdays = 100000) {
        /*
        this.deleteCookie(cname);
        var d = new Date();
        d.setTime(this.baseTime + (exdays * 24 * 60 * 60 * 1000));
        var expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + this.path;
        */
        localStorage[cname] = cvalue;
    }

    public deleteCookie(cname) {
        /*
        let cvalue = ""; //this.getCookie(cname);
        let exdays = -1;
        var d = new Date();
        d.setTime(this.baseTime + (exdays * 24 * 60 * 60 * 1000));
        var expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + this.path;
        */
        if (cname in localStorage) {
            localStorage[cname] = '';
        }
    }

    public getCookie(cname) {
        /*
        var name = cname + "=";
        var decodedCookie = decodeURIComponent(document.cookie);
        var ca = decodedCookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
        */
        if (cname in localStorage) {
            return localStorage[cname];
        }
        return '';
    }
}

import { Observable, Subject } from 'rxjs';

export class MiscUtils {
    public static getStatusString(message: any): string {
        let retVal = message;

        switch (typeof (message)) {
            case 'string':
                break;
            case 'undefined':
                retVal = 'undefined';
                break;
            case 'symbol':
                break;
            case 'function':
                retVal = '[function]';
                break;
            case 'object':
                if (message == null) {
                    // retVal = "null";
                } else {
                    retVal = JSON.stringify(message, (key, value) => {
                        if (typeof (value) == 'function')
                            return '[function]';
                        return value;
                    });
                }
                break;
            default:
                try {
                    retVal = message.toString();
                } catch (e) {

                }
                break;
        }
        return retVal;
    }

    public static getString(obj: any, indent = null) {
        return JSON.stringify(obj, Object.getOwnPropertyNames(obj), indent);
    }

    static copyArray(fromArray) {
        const newArray = [];
        for (let index = 0; index < fromArray.length; index++) {
            const item = fromArray[index];
            let newItem = null;
            if (Array.isArray(item)) {
                newItem = this.copyArray(item);
            } else if (item instanceof Object) {
                newItem = {};
                this.mergeDictionaries(item, newItem);
            } else {
                newItem = item;
            }
            newArray.push(item);
        }
        return newArray;
    }

    static mergeArrays(fromArray, toArray) {
        for (let index = 0; index < fromArray.length; index++) {
            if (toArray.indexOf(fromArray[index]) < 0) {
                toArray.push(fromArray[index]);
            }
        }
    }

    static mergeDictionaries(fromDict, toDict, recurse = true) {
        if (recurse) {
            for (const key in fromDict) {
                if (Array.isArray(fromDict[key])) {
                    if (Array.isArray(toDict[key])) {
                        toDict[key] = this.copyArray(fromDict[key]);
                    } else {
                        toDict[key] = this.copyArray(fromDict[key]);
                    }
                } else if (fromDict[key] instanceof Object) {
                    if (toDict[key] instanceof Object) {
                        this.mergeDictionaries(fromDict[key], toDict[key]);
                    } else {
                        const copyD = {};
                        this.mergeDictionaries(fromDict[key], copyD);
                        toDict[key] = copyD;
                    }
                } else {
                    toDict[key] = fromDict[key];
                }
            }
        } else {
            for (const key in fromDict) {
                toDict[key] = fromDict[key];
            }
        }
    }

    static areArraysTheSame(array1: any[], array2: any[]): boolean {
        if (array1.length == array2.length) {
            for (let index = 0; index < array1.length; index++) {
                if (array2[index] !== array1[index]) {
                    return false;
                }
            }
        } else {
            return false;
        }
        return true;
    }

    static areDictionariesTheSame(dict1: any, dict2: any): boolean {
        const dict1Str = JSON.stringify(dict1);
        const dict2Str = JSON.stringify(dict2);
        return dict1Str === dict2Str;
        /*
                for (let key in dict1) {
                    if (dict1[key] instanceof Object) {
                        if (dict2[key] instanceof Object) {
                            if (!this.areDictionariesTheSame(dict1[key], dict2[key])) {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    } else if (dict1[key] instanceof Array) {
                        if (dict2[key] instanceof Array) {
                            if (!this.areArraysTheSame(dict1[key], dict2[key])) {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    } else {
                        if (dict2[key] !== dict1[key]) {
                            return false;
                        }
                    }
                }
                return true;
        */
    }

    static getUUID() {
        let macro = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

        macro = 'xxxxxxxx';

        return macro.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    static matchRule(str: string, rule: string): boolean {
        // for this solution to work on any string, no matter what characters it has
        const escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');

        // "."  => Find a single character, except newline or line terminator
        // ".*" => Matches any string that contains zero or more characters
        rule = rule.split('*').map(escapeRegex).join('.*');

        // "^"  => Matches any string with the following at the beginning of it
        // "$"  => Matches any string with that in front at the end of it
        rule = '^' + rule + '$';

        // Create a regular expression object for matching string
        const regex = new RegExp(rule);

        // Returns true if it finds a match, otherwise it returns false
        return regex.test(str);
    }

    static getRandomNumber(min: number, max: number) {
        return Math.ceil(Math.random() * (max - min) + min);
    }

    static validateIPaddress(ipaddress) {
        if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
            return (true);
        }
        return (false);
    }

    public static getAddress(address:string) {
        if (address == "" || address == "localhost" || address == "127.0.0.1") {
            return window.location.hostname;
        } else {
            return address;
        }
    }
}

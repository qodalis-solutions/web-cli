import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class CliCanViewService {
    constructor() {}

    canView(): Observable<boolean> {
        return of(true);
    }
}

import { Observable, of } from 'rxjs';

export class CustomCliCanViewService {
    constructor() {}

    canView(): Observable<boolean> {
        // Implement your logic here
        return of(true);
    }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CliTerminalComponent } from './cli-terminal.component';

describe('CliTerminalComponent', () => {
    let component: CliTerminalComponent;
    let fixture: ComponentFixture<CliTerminalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [CliTerminalComponent],
        });
        fixture = TestBed.createComponent(CliTerminalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});

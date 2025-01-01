import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CliComponent } from './cli.component';
import { resolveCliProviders } from '..';

describe('CliComponent', () => {
    let component: CliComponent;
    let fixture: ComponentFixture<CliComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [CliComponent],
            providers: [resolveCliProviders()],
        }).compileComponents();

        fixture = TestBed.createComponent(CliComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});

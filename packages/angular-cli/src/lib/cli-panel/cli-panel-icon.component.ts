import { Component, Input } from '@angular/core';
import { SvgIcon } from '@qodalis/cli';

/** Renders one of the shared panel icons from `@qodalis/cli`. */
@Component({
    standalone: false,
    selector: 'cli-panel-icon',
    template: `
        <svg
            [attr.class]="svgClass"
            [attr.width]="icon.size"
            [attr.height]="icon.size"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            [attr.stroke-width]="icon.strokeWidth"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <ng-container *ngFor="let shape of icon.shapes; trackBy: trackByIndex">
                <svg:polyline *ngIf="shape.tag === 'polyline'" [attr.points]="shape.attrs['points']" />
                <svg:line
                    *ngIf="shape.tag === 'line'"
                    [attr.x1]="shape.attrs['x1']"
                    [attr.y1]="shape.attrs['y1']"
                    [attr.x2]="shape.attrs['x2']"
                    [attr.y2]="shape.attrs['y2']"
                />
                <svg:rect
                    *ngIf="shape.tag === 'rect'"
                    [attr.x]="shape.attrs['x']"
                    [attr.y]="shape.attrs['y']"
                    [attr.width]="shape.attrs['width']"
                    [attr.height]="shape.attrs['height']"
                    [attr.rx]="shape.attrs['rx']"
                    [attr.fill]="shape.attrs['fill']"
                    [attr.stroke]="shape.attrs['stroke']"
                    [attr.opacity]="shape.attrs['opacity']"
                />
            </ng-container>
        </svg>
    `,
    styles: [':host { display: contents; }'],
})
export class CliPanelIconComponent {
    @Input({ required: true }) icon!: SvgIcon;
    @Input() svgClass?: string;

    trackByIndex(index: number): number {
        return index;
    }
}

import { NgModule } from '@angular/core';
import { CopyCodeDirective } from './copy-code.directive';

@NgModule({
    declarations: [CopyCodeDirective],
    exports: [CopyCodeDirective],
})
export class SharedModule {}

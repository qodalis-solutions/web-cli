import { NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CopyCodeDirective } from './copy-code.directive';

@NgModule({
    declarations: [CopyCodeDirective],
    imports: [TranslateModule],
    exports: [CopyCodeDirective, TranslateModule],
})
export class SharedModule {}

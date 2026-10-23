import { NgModule } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { CopyCodeDirective } from './copy-code.directive';

@NgModule({
    declarations: [CopyCodeDirective],
    imports: [TranslatePipe, TranslateDirective],
    exports: [CopyCodeDirective, TranslatePipe, TranslateDirective],
})
export class SharedModule {}

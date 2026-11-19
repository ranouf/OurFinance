import { Directive, Input } from '@angular/core';

/** Shared presentation for native controls that must keep their form and browser semantics. */
@Directive({
  selector: 'input[appUiControl], select[appUiControl], textarea[appUiControl]',
  host: {
    class: 'min-h-11 w-full rounded-[10px] py-2 text-sm text-pop-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pop-primary disabled:bg-slate-100 disabled:text-pop-muted',
    '[class.border]': '!plain',
    '[class.border-pop-border]': '!plain',
    '[class.bg-white]': '!plain',
    '[class.px-3]': '!plain',
    '[class.border-transparent]': 'plain',
    '[class.bg-transparent]': 'plain',
    '[class.px-0]': 'plain',
  },
})
export class UiControlDirective { @Input() plain = false; }

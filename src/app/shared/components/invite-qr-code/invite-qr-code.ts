import { Component, Input, signal } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-invite-qr-code',
  imports: [QRCodeComponent],
  template: `
    <div class="mx-auto w-fit max-w-full rounded-2xl bg-white p-4 shadow-sm" role="img" [attr.aria-label]="label">
      <qrcode [qrdata]="link" [width]="256" [margin]="4" [errorCorrectionLevel]="'M'" [ariaLabel]="label" />
    </div>
    <div class="mt-3 flex flex-wrap justify-center gap-2">
      <button class="min-h-11 rounded-xl bg-pop-primary px-4 py-2 font-bold text-white" type="button" (click)="copy()">{{ copyLabel }}</button>
      @if (canShare()) { <button class="min-h-11 rounded-xl border border-pop-primary px-4 py-2 font-bold text-pop-primary-dark" type="button" (click)="share()">{{ shareLabel }}</button> }
    </div>
    @if (message()) { <p class="mt-2 text-center text-sm" role="status">{{ message() }}</p> }
  `,
})
export class InviteQrCode {
  @Input({ required: true }) link = '';
  @Input({ required: true }) label = '';
  @Input({ required: true }) copyLabel = '';
  @Input({ required: true }) shareLabel = '';
  @Input({ required: true }) copiedLabel = '';
  @Input({ required: true }) failedLabel = '';
  readonly message = signal('');
  readonly canShare = signal(typeof navigator !== 'undefined' && typeof navigator.share === 'function');

  async copy(): Promise<void> {
    try { await navigator.clipboard.writeText(this.link); this.message.set(this.copiedLabel); }
    catch { this.message.set(this.failedLabel); }
  }

  async share(): Promise<void> {
    try { await navigator.share({ url: this.link }); this.message.set(this.copiedLabel); }
    catch { this.message.set(this.failedLabel); }
  }
}

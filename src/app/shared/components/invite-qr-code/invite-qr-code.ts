import { Component, Input, signal } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { UiButton } from '../ui-button/ui-button';

@Component({
  selector: 'app-invite-qr-code',
  imports: [QRCodeComponent, UiButton],
  templateUrl: './invite-qr-code.html',
})
export class InviteQrCode {
  @Input({ required: true }) link = '';
  @Input({ required: true }) label = '';
  @Input({ required: true }) copyLabel = '';
  @Input({ required: true }) shareLabel = '';
  @Input({ required: true }) copiedLabel = '';
  @Input({ required: true }) failedLabel = '';
  @Input() width = 256;
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

import { Component, Input, OnChanges, OnDestroy, SimpleChanges, signal } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { ReceiptService, type Receipt } from '../../core/firebase/receipt-service';

@Component({
  selector: 'app-receipt-panel',
  template: `
    <section class="rounded-xl border border-slate-200 p-3" aria-label="Reçus privés">
      <h3 class="font-semibold">Reçus privés</h3>
      <p class="mt-1 text-slate-600">PNG ou JPEG, 2 Mo maximum. Les membres actifs peuvent consulter les reçus.</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <label class="cursor-pointer rounded-lg border border-teal-700 px-3 py-2 text-teal-800">
          Ajouter un reçu
          <input class="sr-only" type="file" accept="image/png,image/jpeg" [disabled]="busy()" (change)="upload($event)" />
        </label>
        <button class="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50" type="button" [disabled]="busy()" (click)="refresh()">Actualiser</button>
      </div>
      @if (receipts().length) {
        <ul class="mt-3 space-y-2">
          @for (receipt of receipts(); track receipt.id; let i = $index) {
            <li class="flex flex-wrap items-center gap-2">
              <span>Reçu {{ i + 1 }}</span>
              <button class="rounded-lg border border-teal-700 px-2 py-1 text-teal-800 disabled:opacity-50" type="button" [disabled]="busy()" (click)="view(receipt)">Voir</button>
              @if (receipt.ownerId === user?.uid || groupOwnerId === user?.uid) { <button class="rounded-lg border border-rose-700 px-2 py-1 text-rose-800 disabled:opacity-50" type="button" [disabled]="busy()" (click)="remove(receipt)">Supprimer</button> }
            </li>
          }
        </ul>
      } @else if (!busy()) { <p class="mt-2 text-slate-600">Aucun reçu.</p> }
      @if (imageUrl()) {
        <div class="mt-3">
          <img class="max-h-96 max-w-full rounded-lg border border-slate-200 object-contain" [src]="imageUrl()" alt="Reçu privé" />
          <button class="mt-2 rounded-lg border border-slate-300 px-3 py-2" type="button" (click)="closeImage()">Fermer le reçu</button>
        </div>
      }
      @if (message()) { <p class="mt-2 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class ReceiptPanel implements OnChanges, OnDestroy {
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  @Input({ required: true }) user?: User;
  @Input({ required: true }) groupId = '';
  @Input({ required: true }) expenseId = '';
  @Input({ required: true }) groupOwnerId = '';
  readonly receipts = signal<Receipt[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly imageUrl = signal('');
  private service?: ReceiptService;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) this.service = new ReceiptService(this.firebaseApp, this.workerUrl);
    if (changes['groupId'] || changes['expenseId']) { this.closeImage(); void this.refresh(); }
  }
  ngOnDestroy(): void { this.closeImage(); }
  closeImage(): void { if (this.imageUrl()) URL.revokeObjectURL(this.imageUrl()); this.imageUrl.set(''); }

  async refresh(): Promise<void> {
    if (!this.service || !this.groupId || !this.expenseId) return;
    this.busy.set(true);
    try { this.receipts.set(await this.service.list(this.groupId, this.expenseId)); this.message.set(''); }
    catch { this.message.set('Reçus indisponibles.'); }
    finally { this.busy.set(false); }
  }

  async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.service || !this.user) return;
    this.busy.set(true);
    try { await this.service.upload(this.user, this.groupId, this.expenseId, file); this.message.set('Reçu ajouté.'); this.receipts.set(await this.service.list(this.groupId, this.expenseId)); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'Ajout impossible.'); }
    finally { this.busy.set(false); }
  }

  async view(receipt: Receipt): Promise<void> {
    if (!this.service || !this.user) return;
    this.busy.set(true);
    try { const image = await this.service.read(this.user, this.groupId, this.expenseId, receipt.id); this.closeImage(); this.imageUrl.set(URL.createObjectURL(image)); this.message.set(''); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'Lecture impossible.'); }
    finally { this.busy.set(false); }
  }

  async remove(receipt: Receipt): Promise<void> {
    if (!this.service || !this.user) return;
    this.busy.set(true);
    try { await this.service.remove(this.user, this.groupId, this.expenseId, receipt.id); this.closeImage(); this.receipts.set(this.receipts().filter(item => item.id !== receipt.id)); this.message.set('Reçu supprimé.'); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'Suppression impossible.'); }
    finally { this.busy.set(false); }
  }
}

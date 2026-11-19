import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { CommentService, type ExpenseComment } from '../../core/firebase/comment-service';
import { locale } from '../../shared/utils/i18n';
import { expenseMessage, expenseText } from './expense-text';

@Component({
  selector: 'app-comment-panel',
  imports: [UiControlDirective, UiAlert, UiButton, FormsModule],
  template: `
    <section class="rounded-2xl border border-pop-border bg-pop-lavender p-4" [attr.aria-label]="text('comments')">
      <h3 class="font-extrabold text-pop-text">{{ text('comments') }}</h3>
      <form class="mt-3 space-y-2" (ngSubmit)="save()">
        <label class="block font-bold">{{ text('newComment') }}
          <textarea appUiControl class="mt-2 w-full" name="commentText" [(ngModel)]="draft" maxlength="1000" rows="3" required></textarea>
        </label>
        <app-ui-button variant="primary"  type="submit" [disabled]="busy() || !draft.trim()">{{ text('publishComment') }}</app-ui-button>
      </form>
      @if (entries().length) {
        <ol class="mt-4 divide-y divide-pop-border">
          @for (entry of entries(); track entry.id) {
            <li class="py-3">
              <p class="font-bold">{{ entry.authorId === user?.uid ? text('me') : text('otherMember') }} · {{ date(entry) }}</p>
              <p class="mt-1 whitespace-pre-wrap break-words">{{ entry.text }}</p>
            </li>
          }
        </ol>
      } @else if (!busy() && !message()) { <p class="mt-3 text-pop-muted">{{ text('noComments') }}</p> }
      @if (hasMore()) { <app-ui-button variant="secondary" class="mt-2" type="button" [disabled]="busy()" (click)="loadMore()">{{ text('moreComments') }}</app-ui-button> }
      @if (message()) { <app-ui-alert [variant]="message() === 'commentPublished' ? 'success' : 'error'" class="mt-2">{{ displayMessage(message()) }}</app-ui-alert> }
    </section>
  `,
})
export class CommentPanel implements OnChanges {
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  @Input({ required: true }) user?: User;
  @Input({ required: true }) groupId = '';
  @Input({ required: true }) expenseId = '';
  @Output() readonly changed = new EventEmitter<void>();
  readonly entries = signal<ExpenseComment[]>([]);
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly text = expenseText;
  readonly displayMessage = expenseMessage;
  draft = '';
  private service?: CommentService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private pendingKey?: string;
  private pendingText?: string;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) this.service = new CommentService(this.firebaseApp, this.workerUrl);
    if (changes['groupId'] || changes['expenseId']) void this.refresh();
  }
  date(entry: ExpenseComment): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(entry.createdAt.toDate()); }
  async refresh(): Promise<void> { this.entries.set([]); this.last = undefined; this.hasMore.set(false); this.message.set(''); await this.loadMore(); }
  async loadMore(): Promise<void> {
    if (!this.service || !this.groupId || !this.expenseId || this.busy()) return;
    this.busy.set(true);
    try {
      const page = await this.service.history(this.groupId, this.expenseId, this.last);
      this.entries.update(entries => [...entries, ...page.entries]); this.last = page.last; this.hasMore.set(page.hasMore);
    } catch { this.message.set('commentsUnavailable'); }
    finally { this.busy.set(false); }
  }
  async save(): Promise<void> {
    if (!this.service || !this.user || !this.draft.trim() || this.busy()) return;
    const text = this.draft.trim();
    if (text.length > 1000) { this.message.set('commentTooLong'); return; }
    if (this.pendingText !== text) this.pendingKey = undefined;
    const idempotencyKey = this.pendingKey ?? crypto.randomUUID();
    this.pendingKey = idempotencyKey; this.pendingText = text;
    this.busy.set(true);
    try {
      await this.service.create(this.user, this.groupId, this.expenseId, text, idempotencyKey);
      this.pendingKey = undefined; this.pendingText = undefined; this.draft = '';
      this.message.set('commentPublished'); this.changed.emit();
      const page = await this.service.history(this.groupId, this.expenseId);
      this.entries.set(page.entries); this.last = page.last; this.hasMore.set(page.hasMore);
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'commentFailed'); }
    finally { this.busy.set(false); }
  }
}

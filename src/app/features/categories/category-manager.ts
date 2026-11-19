import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { Component, EventEmitter, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { CategoryService, type CategoryDraft } from '../../core/firebase/category-service';
import type { Group } from '../../core/firebase/group-model';
import { categoryColorClass, categoryColors, categoryIcons, type CustomCategory } from '../../shared/utils/categories';
import { categoryColorLabel, categoryIconLabel } from '../../shared/utils/category-option-label';
import { language, t, type MessageKey } from '../../shared/utils/i18n';

@Component({
  selector: 'app-category-manager',
  imports: [UiControlDirective, UiAlert, UiButton, FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" [attr.aria-label]="t('groupCategories')">
      <h2 class="text-lg font-semibold">{{ t('groupCategories') }}</h2>
      <p class="mt-1 text-sm text-slate-600">{{ t('categoryIntro') }}</p>
      <label class="mt-4 block text-sm font-medium">{{ t('group') }}
        <select appUiControl class="mt-1 w-full" name="categoryGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="loadGroup()">
          <option value="">{{ t('chooseGroup') }}</option>
          @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
        </select>
      </label>
      @if (selectedGroupId) {
        <label class="mt-4 block text-sm font-medium">{{ t('customCategory') }}
          <select appUiControl class="mt-1 w-full" name="managedCategory" [(ngModel)]="selectedId" (ngModelChange)="selectCategory()">
            <option value="">{{ t('newCategory') }}</option>
            @for (category of items(); track category.id) { <option [value]="category.id">{{ category.icon }} {{ category.label }}{{ category.status === 'archived' ? t('archivedSuffix') : '' }}</option> }
          </select>
        </label>
        <label class="mt-3 block text-sm font-medium">{{ t('categoryName') }}
          <input appUiControl class="mt-1 w-full" name="categoryName" [(ngModel)]="draft.name" maxlength="40" />
        </label>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <label class="block text-sm font-medium">{{ t('categoryIcon') }}
            <select appUiControl class="mt-1 w-full" name="categoryIcon" [(ngModel)]="draft.iconId">
              @for (icon of icons; track icon.id) { <option [value]="icon.id">{{ icon.glyph }} {{ iconLabel(icon.id) }}</option> }
            </select>
          </label>
          <label class="block text-sm font-medium">{{ t('categoryColor') }}
            <select appUiControl class="mt-1 w-full" name="categoryColor" [(ngModel)]="draft.color">
              @for (color of colors; track color.id) { <option [value]="color.id">{{ colorLabel(color.id) }}</option> }
            </select>
          </label>
        </div>
        <p class="mt-3 text-sm"><span class="rounded-md px-2 py-1" [class]="colorClass(draft.color)">{{ previewIcon() }} {{ draft.name || t('categoryPreview') }}</span></p>
        <div class="mt-4 flex flex-wrap gap-2">
          <app-ui-button variant="primary"  type="button" [disabled]="busy() || !draft.name.trim()" (click)="save()">{{ selectedId ? t('saveCategory') : t('createCategory') }}</app-ui-button>
          @if (selectedId) {
            <app-ui-button variant="secondary"  type="button" [disabled]="busy()" (click)="toggleArchive()">{{ selected()?.status === 'archived' ? t('reactivateCategory') : t('archiveCategory') }}</app-ui-button>
          }
        </div>
        @if (items().length) { <p class="mt-3 text-sm text-slate-600">{{ items().length }} {{ t(items().length === 1 ? 'categoryCountOne' : 'categoryCountMany') }}</p> }
      }
      @if (message(); as key) { <app-ui-alert variant="info" class="mt-4">{{ t(key) }}</app-ui-alert> }
    </section>
  `,
})
export class CategoryManager implements OnChanges {
  readonly t = t;
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  @Input({ required: true }) user?: User;
  @Output() readonly changed = new EventEmitter<void>();
  readonly icons = categoryIcons;
  readonly colors = categoryColors;
  readonly items = signal<CustomCategory[]>([]);
  readonly busy = signal(false);
  readonly message = signal<MessageKey | null>(null);
  selectedGroupId = '';
  selectedId = '';
  draft: CategoryDraft = this.emptyDraft();
  private service?: CategoryService;

  ngOnChanges(): void { if (this.firebaseApp && this.workerUrl) this.service = new CategoryService(this.firebaseApp, this.workerUrl); }
  private emptyDraft(): CategoryDraft { return { name: '', iconId: 'pin', color: 'teal', status: 'active' }; }
  selected(): CustomCategory | undefined { return this.items().find(item => item.id === this.selectedId); }
  previewIcon(): string { return this.icons.find(icon => icon.id === this.draft.iconId)?.glyph ?? '📌'; }
  colorClass(color: string): string { return categoryColorClass(color); }
  iconLabel(icon: typeof categoryIcons[number]['id']): string { return categoryIconLabel(icon, language()); }
  colorLabel(color: typeof categoryColors[number]['id']): string { return categoryColorLabel(color, language()); }
  selectCategory(): void {
    const item = this.selected();
    this.draft = item ? { name: item.label, iconId: item.iconId, color: item.color, status: item.status } : this.emptyDraft();
    this.message.set(null);
  }
  async loadGroup(): Promise<void> {
    this.selectedId = ''; this.draft = this.emptyDraft(); this.items.set([]); this.message.set(null);
    await this.refresh();
  }
  private async refresh(): Promise<void> {
    const groupId = this.selectedGroupId;
    if (!groupId || !this.service) return;
    try {
      const items = await this.service.list(groupId);
      if (groupId === this.selectedGroupId) this.items.set(items);
    } catch { if (groupId === this.selectedGroupId) this.message.set('categoriesUnavailable'); }
  }
  async save(): Promise<void> {
    if (!this.service || !this.user || !this.selectedGroupId || !this.draft.name.trim() || this.busy()) return;
    this.busy.set(true); this.message.set(null);
    try {
      if (this.selectedId) await this.service.update(this.user, this.selectedGroupId, this.selectedId, this.draft);
      else this.selectedId = await this.service.create(this.user, this.selectedGroupId, this.draft);
      await this.refresh(); this.selectCategory(); this.changed.emit(); this.message.set('categorySaved');
    } catch { this.message.set('categorySaveFailed'); }
    finally { this.busy.set(false); }
  }
  async toggleArchive(): Promise<void> {
    const item = this.selected();
    if (!item || !this.service || !this.user || !this.selectedGroupId || this.busy()) return;
    this.busy.set(true); this.message.set(null);
    try {
      await this.service.update(this.user, this.selectedGroupId, item.id, { name: item.label, iconId: item.iconId, color: item.color, status: item.status === 'active' ? 'archived' : 'active' });
      await this.refresh(); this.selectCategory(); this.changed.emit(); this.message.set(item.status === 'active' ? 'categoryManagerArchived' : 'categoryManagerReactivated');
    } catch { this.message.set('categoryUpdateFailed'); }
    finally { this.busy.set(false); }
  }
}

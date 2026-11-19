import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { GroupLifecycleRequestError, GroupService } from '../../core/firebase/group-service';
import type { Group } from '../../core/firebase/group-model';
import { categoryColors, categoryIcons } from '../../shared/utils/categories';
import { language } from '../../shared/utils/i18n';
import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent, type DropdownOption } from '../../shared/components/dropdown/dropdown.component';
import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { groupMetadataText } from './group-metadata-text';

@Component({
  selector: 'app-group-metadata-panel',
  imports: [FormsModule, FieldComponent, DropdownComponent, UiControlDirective, UiButton, UiAlert],
  templateUrl: './group-metadata-panel.html',
})
export class GroupMetadataPanel implements OnChanges {
  @Input({ required: true }) group!: Group;
  @Input({ required: true }) user!: User;
  @Input({ required: true }) firebaseApp!: FirebaseApp;
  @Input({ required: true }) workerUrl = '';
  @Output() readonly changed = new EventEmitter<void>();
  readonly text = computed(() => groupMetadataText[language()]);
  readonly icons = categoryIcons;
  readonly colors = categoryColors;
  readonly iconOptions = computed<DropdownOption[]>(() => [
    { value: '', label: this.text().none },
    ...this.icons.map((icon, index) => ({ value: icon.id, label: this.text().icons[index] })),
  ]);
  readonly colorOptions = computed<DropdownOption[]>(() => [
    { value: '', label: this.text().none },
    ...this.colors.map((color, index) => ({ value: color.id, label: this.text().colors[index] })),
  ]);
  readonly busy = signal(false);
  readonly failed = signal(false);
  readonly message = signal('');
  name = '';
  iconId = '';
  color = '';
  description = '';

  ngOnChanges(): void {
    this.name = this.group.name;
    this.iconId = this.group.iconId ?? '';
    this.color = this.group.color ?? '';
    this.description = this.group.description ?? '';
    this.message.set('');
    this.failed.set(false);
  }
  canManage(): boolean { return this.group.status === 'active' && this.group.ownerId === this.user.uid; }
  iconLabel(id: string | undefined): string {
    const index = this.icons.findIndex(icon => icon.id === id);
    return index < 0 ? this.text().none : this.text().icons[index];
  }
  colorLabel(id: string | undefined): string {
    const index = this.colors.findIndex(color => color.id === id);
    return index < 0 ? this.text().none : this.text().colors[index];
  }
  async save(): Promise<void> {
    if (!this.canManage() || this.busy() || !this.name.trim()) return;
    this.busy.set(true); this.failed.set(false); this.message.set('');
    try {
      await new GroupService(this.firebaseApp, this.workerUrl).updateMetadata(this.user, this.group.id, {
        name: this.name.trim(), ...(this.iconId ? { iconId: this.iconId } : {}),
        ...(this.color ? { color: this.color } : {}), description: this.description.trim(),
      });
      this.message.set(this.text().saved);
      this.changed.emit();
    } catch (error) {
      this.failed.set(true);
      this.message.set(this.text()[error instanceof GroupLifecycleRequestError && error.status === 503 ? 'unavailable' : 'failed']);
    } finally { this.busy.set(false); }
  }
}

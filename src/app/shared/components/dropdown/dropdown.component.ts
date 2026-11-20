import { Component, ElementRef, HostListener, Input, booleanAttribute, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UiIconBadge, type UiIconTone } from '../ui-icon-badge/ui-icon-badge';

export interface DropdownOption {
  readonly value: string;
  readonly label: string;
  readonly swatch?: string;
  readonly iconSrc?: string;
  readonly iconName?: 'house' | 'plane' | 'utensils' | 'shopping-cart' | 'tram-front' | 'graduation-cap' | 'heart-pulse' | 'ticket' | 'gift' | 'wrench' | 'map-pin';
  readonly tone?: UiIconTone;
  readonly flag?: string;
  readonly disabled?: boolean;
}

@Component({
  selector: 'app-dropdown',
  host: { class: 'block' },
  imports: [UiIconBadge],
  templateUrl: './dropdown.component.html',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DropdownComponent), multi: true }],
})
export class DropdownComponent implements ControlValueAccessor {
  @Input({ required: true }) controlId = '';
  @Input() options: readonly DropdownOption[] = [];
  @Input() placeholder = '';
  @Input() invalid = false;
  @Input() describedBy = '';
  readonly open = signal(false);
  readonly activeIndex = signal(0);
  value = '';
  @Input() disabled = false;
  @Input({ transform: booleanAttribute }) required = false;
  @Input() searchable = false;
  @Input() searchLabel = 'Search options';
  readonly searchTerm = signal('');
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  filteredOptions(): readonly DropdownOption[] {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    return term ? this.options.filter(option => `${option.label} ${option.value}`.toLocaleLowerCase().includes(term)) : this.options;
  }
  selected(): DropdownOption | undefined { return this.options.find(option => option.value === this.value); }
  writeValue(value: string | null): void { this.value = value ?? ''; }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  toggle(): void {
    if (this.disabled) return;
    const next = !this.open();
    this.open.set(next);
    if (next) { this.searchTerm.set(''); this.activeIndex.set(Math.max(0, this.options.findIndex(option => option.value === this.value))); }
    this.onTouched();
  }

  choose(option: DropdownOption): void {
    if (option.disabled) return;
    this.value = option.value;
    this.onChange(option.value);
    this.onTouched();
    this.open.set(false);
    this.searchTerm.set('');
    this.host.nativeElement.querySelector<HTMLButtonElement>('[role="combobox"]')?.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;
    if (event.key === 'Escape') { this.open.set(false); return; }
    if (event.key === 'Tab') { this.open.set(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open()) this.open.set(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      let index = this.activeIndex();
      const choices = this.filteredOptions();
      for (let count = 0; count < choices.length; count++) {
        index = (index + step + choices.length) % choices.length;
        if (!choices[index].disabled) { this.activeIndex.set(index); break; }
      }
    } else if ((event.key === 'Enter' || event.key === ' ') && this.open()) {
      event.preventDefault();
      const option = this.filteredOptions()[this.activeIndex()];
      if (option) this.choose(option);
    }
  }

  onSearch(event: Event): void { this.searchTerm.set((event.target as HTMLInputElement).value); this.activeIndex.set(0); }
  onSearchKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter') event.preventDefault();
    if (event.key === 'Escape') { this.open.set(false); this.host.nativeElement.querySelector<HTMLButtonElement>('[role=combobox]')?.focus(); }
  }

  @HostListener('document:click', ['$event'])
  closeOutside(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}

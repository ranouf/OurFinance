import { Component } from '@angular/core';

@Component({
  selector: 'app-statistics-controls',
  standalone: true,
  templateUrl: './controls.html',
  styles: [':host { display: contents; }']
})
export class StatisticsControlsComponent {
  start = '2026-11-01';
  end = '2026-11-18';
  savedUnit = 'Days';
  private readonly dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

  get rangeLabel(): string {
    return this.dateFormat.format(new Date(this.start)) + ' – ' + this.dateFormat.format(new Date(this.end));
  }

  restore(event: Event, form: HTMLFormElement, endInput: HTMLInputElement): void {
    if ((event as ToggleEvent).newState === 'open') {
      form.reset();
      (form.elements.namedItem('start') as HTMLInputElement).value = this.start;
      endInput.value = this.end;
      endInput.min = this.start;
      (form.elements.namedItem('period') as RadioNodeList).value = this.savedUnit;
    }
  }

  apply(event: Event, trigger: HTMLButtonElement): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    this.start = String(values.get('start'));
    this.end = String(values.get('end'));
    this.savedUnit = String(values.get('period'));
    (trigger.popoverTargetElement as HTMLElement).hidePopover();
    trigger.focus();
  }
}


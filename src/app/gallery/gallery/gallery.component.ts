import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CalendarComponent } from '../../shared/components/calendar/calendar.component';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ControlErrorsComponent } from '../../shared/components/control-errors/control-errors.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { FieldComponent } from '../../shared/components/field/field.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { InviteQrCode } from '../../shared/components/invite-qr-code/invite-qr-code';
import { RadioGroupComponent } from '../../shared/components/radio-group/radio-group.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiAccordion } from '../../shared/components/ui-accordion/ui-accordion';
import { UiAvatarStack } from '../../shared/components/ui-avatar-stack/ui-avatar-stack';
import { UiBadge } from '../../shared/components/ui-badge/ui-badge';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { UiCard } from '../../shared/components/ui-card/ui-card';
import { UiChip } from '../../shared/components/ui-chip/ui-chip';
import { UiToast } from '../../shared/components/ui-toast/ui-toast';
import { UiDialog } from '../../shared/components/ui-dialog/ui-dialog';
import { UiDonutChart } from '../../shared/components/ui-donut-chart/ui-donut-chart';
import { UiEmptyState } from '../../shared/components/ui-empty-state/ui-empty-state';
import { UiGroupCard } from '../../shared/components/ui-group-card/ui-group-card';
import { UiIconBadge } from '../../shared/components/ui-icon-badge/ui-icon-badge';
import { UiPagination } from '../../shared/components/ui-pagination/ui-pagination';
import { UiQuickAction } from '../../shared/components/ui-quick-action/ui-quick-action';
import { UiSkeleton } from '../../shared/components/ui-skeleton/ui-skeleton';
import { UiStepper } from '../../shared/components/ui-stepper/ui-stepper';
import { UiSuccessState } from '../../shared/components/ui-success-state/ui-success-state';
import { UiTable } from '../../shared/components/ui-table/ui-table';
import { UiTabs } from '../../shared/components/ui-tabs/ui-tabs';
import { UiTooltip } from '../../shared/components/ui-tooltip/ui-tooltip';
import { galleryAmount, galleryDate } from './gallery-format';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-gallery',
  imports: [CalendarComponent, CheckboxComponent, ControlErrorsComponent, DropdownComponent, FieldComponent, InputComponent, InviteQrCode, RadioGroupComponent, ReactiveFormsModule, SelectComponent, TextareaComponent, ToggleComponent, UiAccordion, UiAlert, UiAvatarStack, UiBadge, UiButton, UiCard, UiChip, UiToast, UiDialog, UiDonutChart, UiEmptyState, UiGroupCard, UiIconBadge, UiPagination, UiQuickAction, UiSkeleton, UiStepper, UiSuccessState, UiTable, UiTabs, UiTooltip, TranslatePipe],
  templateUrl: './gallery.component.html',
})
export class GalleryComponent {
  readonly demoAmount = galleryAmount;
  readonly demoDate = galleryDate;
  activeTab = 'all';
  activePage = 1;
  activePeriod = 'months';
  activeSplit = 'equal';
  quantity = 2;
  chipSelected = false;
  readonly textControl = new FormControl('Famille fictive');
  readonly numberControl = new FormControl<number | null>(42);
  readonly emailControl = new FormControl('incorrect', [Validators.email]);
  readonly phoneControl = new FormControl('555-0100');
  readonly passwordControl = new FormControl('exemple123');
  readonly searchControl = new FormControl('Restaurant');
  readonly urlControl = new FormControl('https://example.invalid');
  readonly dateControl = new FormControl('2026-11-17');
  readonly timeControl = new FormControl('12:30');
  readonly selectControl = new FormControl('cad');
  readonly textareaControl = new FormControl('Dépense fictive pour la démonstration.');
  readonly checkboxControl = new FormControl(true);
  readonly checkboxOffControl = new FormControl(false);
  readonly toggleControl = new FormControl(false);
  readonly radioControl = new FormControl('equal');
  readonly calendarControl = new FormControl('2026-11-17');
  readonly exampleDescription = new FormControl('Dîner entre amis');
  readonly exampleAmount = new FormControl<number | null>(86.40);
  readonly exampleCategory = new FormControl('restaurant');
  readonly disabledControl = new FormControl({ value: '', disabled: true });
  readonly examplePayer = new FormControl('Alex');
  readonly fieldDefaultControl = new FormControl('Ma dépense');
  readonly fieldFocusControl = new FormControl('Ma dépense');
  readonly fieldErrorControl = new FormControl('', [Validators.required]);
  readonly selectorCategory = new FormControl('restaurant');
  readonly selectorErrorCategory = new FormControl('', [Validators.required]);

  constructor() { this.emailControl.markAsTouched(); this.fieldErrorControl.markAsTouched(); this.selectorErrorCategory.markAsTouched(); }
}

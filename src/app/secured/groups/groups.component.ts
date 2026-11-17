import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { App } from '../../app';
import { t } from '../../shared/utils/i18n';
import { GroupCurrencyPanel } from '../../features/groups/group-currency-panel';
import { QrInvitationPanel } from '../../features/groups/qr-invitation-panel';
import { CategoryManager } from '../../features/categories/category-manager';

@Component({
  imports: [FormsModule, GroupCurrencyPanel, QrInvitationPanel, CategoryManager],
  templateUrl: './groups.component.html',
})
export class GroupsPage { readonly app = inject(App); readonly t = t; }

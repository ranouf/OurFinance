import { Component, inject } from '@angular/core';
import { App } from '../../app';
import { t } from '../../shared/utils/i18n';
import { ProfilePanel } from '../../features/profile/profile-panel';
import { ActivityHistory } from '../../features/activity/activity-history';
import { ExportPanel } from '../../features/import-export/export-panel';
import { ImportPanel } from '../../features/import-export/import-panel';
import { RestorePanel } from '../../features/import-export/restore-panel';

@Component({
  imports: [ProfilePanel, ActivityHistory, ExportPanel, ImportPanel, RestorePanel],
  templateUrl: './account.component.html',
})
export class AccountPage { readonly app = inject(App); readonly t = t; }

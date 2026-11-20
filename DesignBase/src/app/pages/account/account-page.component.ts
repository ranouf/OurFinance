import { Component } from '@angular/core';
import { AuthenticatedLayoutComponent } from '../../layouts/authenticated-layout.component';
import { AccountBannerComponent } from './banner.component';
import { AccountProfileComponent } from './profile.component';
import { AccountActivityComponent } from './activity.component';
import { AccountDataManagementComponent } from './dataManagement.component';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [AuthenticatedLayoutComponent, AccountBannerComponent, AccountProfileComponent, AccountActivityComponent, AccountDataManagementComponent],
  template: `<app-authenticated-layout route="account" title="My Account" subtitle="Manage your profile, preferences and data.">
    <app-account-banner banner />
    <div content class="account-layout"><app-account-profile /><div class="account-right"><app-account-activity /><app-account-data-management /></div></div>
  </app-authenticated-layout>`
})
export class AccountPageComponent {}

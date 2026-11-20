import { Component } from '@angular/core';
import { AuthenticatedLayoutComponent } from '../../layouts/authenticated-layout.component';
import { GroupsBannerComponent } from './banner.component';
import { GroupsGroupListComponent } from './groupList.component';
import { GroupsSummaryComponent } from './summary.component';
import { GroupsMembersComponent } from './members.component';
import { GroupsCategoriesComponent } from './categories.component';

@Component({
  selector: 'app-groups-page',
  standalone: true,
  imports: [AuthenticatedLayoutComponent, GroupsBannerComponent, GroupsGroupListComponent, GroupsSummaryComponent, GroupsMembersComponent, GroupsCategoriesComponent],
  template: `<app-authenticated-layout route="groups" title="Groups" subtitle="Organize and manage shared finances by group.">
    <app-groups-banner banner />
    <div content class="groups-layout"><app-groups-group-list /><div class="groups-right"><app-groups-summary /><div class="groups-detail"><app-groups-members /><app-groups-categories /></div></div></div>
  </app-authenticated-layout>`
})
export class GroupsPageComponent {}

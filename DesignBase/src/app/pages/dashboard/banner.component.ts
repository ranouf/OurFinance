import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-banner',
  standalone: true,
  templateUrl: './banner.html',
  styles: [':host { display: contents; }']
})
export class DashboardBannerComponent {}

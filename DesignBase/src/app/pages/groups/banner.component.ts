import { Component } from '@angular/core';

@Component({
  selector: 'app-groups-banner',
  standalone: true,
  templateUrl: './banner.html',
  styles: [':host { display: contents; }']
})
export class GroupsBannerComponent {}

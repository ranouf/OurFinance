import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppShell } from '../../shared/components/app-shell/app-shell';

@Component({
  selector: 'app-authentication-layout',
  imports: [AppShell, RouterOutlet],
  templateUrl: './authentication-layout.component.html',
})
export class AuthenticationLayoutComponent {}

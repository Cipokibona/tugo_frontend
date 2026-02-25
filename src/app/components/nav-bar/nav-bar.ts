import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ServiceApi } from '../../services/service-api';

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss',
})
export class NavBar {
  constructor(private service: ServiceApi) {}

  logout() {
    this.service.logout();
  }
}

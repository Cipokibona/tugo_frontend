import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ServiceApi } from '../../services/service-api';

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss',
})
export class NavBar implements OnInit {
  unreadNotificationsCount = 0;

  constructor(private service: ServiceApi) {}

  ngOnInit(): void {
    this.loadUnreadNotificationsCount();
  }

  loadUnreadNotificationsCount() {
    this.service.getNotifications().subscribe({
      next: (notifications) => {
        this.unreadNotificationsCount = (notifications || []).filter(
          (notification: any) => !notification?.is_read
        ).length;
      },
      error: () => {
        this.unreadNotificationsCount = 0;
      },
    });
  }

  logout() {
    this.service.logout();
  }
}

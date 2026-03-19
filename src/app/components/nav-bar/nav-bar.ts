import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ServiceApi } from '../../services/service-api';
import { LanguageService, AppLanguage } from '../../services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss',
})
export class NavBar implements OnInit {
  user: any | null = null;
  unreadNotificationsCount = 0;

  constructor(
    private service: ServiceApi,
    public languageService: LanguageService
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadUnreadNotificationsCount();
  }

  loadCurrentUser() {
    this.service.getUser().subscribe({
      next: (user) => {
        this.user = user;
      },
      error: () => {
        this.user = null;
      },
    });
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

  onLanguageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const language = target.value as AppLanguage;
    if (language === 'fr' || language === 'en') {
      this.languageService.setLanguage(language);
    }
  }
}

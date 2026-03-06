import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NavBar } from './components/nav-bar/nav-bar';
import { filter } from 'rxjs';
import { PushNotificationService } from './services/push-notification.service';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavBar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('tugo');
  private platformId = inject(PLATFORM_ID);

  constructor(
    private router: Router,
    private pushNotificationService: PushNotificationService
  ) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const route = this.router.routerState.root.snapshot;
        this.showNav = !route.firstChild?.data['hideNav'];
      });
  }

  showNav = true;

  ngOnInit(): void {
    this.pushNotificationService.initialize();
    this.setupServiceWorkerMessageHandler();
  }

  private setupServiceWorkerMessageHandler() {
    if (!isPlatformBrowser(this.platformId) || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data;
      if (data?.type === 'OPEN_URL' && data?.url) {
        this.router.navigateByUrl(data.url);
      }
    });
  }
}

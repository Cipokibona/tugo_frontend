import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ServiceApi } from './service-api';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private initialized = false;

  constructor(private serviceApi: ServiceApi) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!this.serviceApi.getToken()) return;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await this.resolvePermission();
      if (permission !== 'granted') return;

      const keyResponse = await firstValueFrom(this.serviceApi.getPushPublicKey());
      const publicKey = keyResponse?.public_key || '';
      if (!publicKey) return;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToArrayBuffer(publicKey),
        });
      }

      await firstValueFrom(this.serviceApi.subscribePushSubscription(subscription.toJSON()));
      this.initialized = true;
    } catch (error) {
      // Keep app flow intact when push setup fails.
      console.warn('Push notification setup failed', error);
    }
  }

  private async resolvePermission(): Promise<NotificationPermission> {
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.requestPermission();
  }

  private urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer as ArrayBuffer;
  }
}

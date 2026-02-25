import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ServiceApi } from '../../services/service-api';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, RouterLink],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications implements OnInit {
  loading = false;
  errorMessage: string | null = null;

  user: any | null = null;
  ridesById = new Map<number, any>();

  notifications: any[] = [];
  notificationMessages: any[] = [];
  groupMessages: any[] = [];

  constructor(private service: ServiceApi) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      user: this.service.getUser(),
      rides: this.service.getRides(),
      notifications: this.service.getNotifications(),
      conversations: this.service.getConversations(),
      messages: this.service.getMessages(),
    }).subscribe({
      next: ({ user, rides, notifications, conversations, messages }) => {
        this.user = user;
        this.ridesById = new Map((rides || []).map((ride: any) => [ride.id, ride]));
        this.notifications = [...(notifications || [])].sort((a: any, b: any) => {
          const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
          const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        const conversationMap = new Map((conversations || []).map((conversation: any) => [conversation.id, conversation]));

        const userConversationIds = new Set(
          (conversations || [])
            .filter((conversation: any) => (conversation.participants || []).includes(user.id))
            .map((conversation: any) => conversation.id)
        );

        const userMessages = (messages || [])
          .filter((message: any) => userConversationIds.has(message.conversation))
          .sort((a: any, b: any) => {
            const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
            const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
            return timeB - timeA;
          })
          .map((message: any) => ({
            ...message,
            conversationData: conversationMap.get(message.conversation),
          }));

        this.notificationMessages = userMessages.filter((message: any) =>
          (message.content || '').startsWith('NOTIFICATION:')
        );
        this.groupMessages = userMessages.filter((message: any) =>
          !(message.content || '').startsWith('NOTIFICATION:')
        );

        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.detail || error?.detail || 'Unable to load notifications';
        this.loading = false;
      }
    });
  }

  messageTime(item: any): string {
    const rawDate = item.created_at || item.createdAt;
    if (!rawDate) return '';

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  messageRide(message: any): string {
    const rideId = message?.conversationData?.ride;
    if (!rideId) return 'General conversation';

    const ride = this.ridesById.get(rideId);
    if (!ride) return `Ride #${rideId}`;

    return `${ride.from_city} -> ${ride.to_city}`;
  }

  notificationTitle(notification: any): string {
    return notification?.title || 'Notification';
  }

  notificationMessage(notification: any): string {
    return notification?.message || '';
  }

  notificationRideId(notification: any): number | null {
    const message = this.notificationMessage(notification);
    const match = message.match(/\/details-trip\/(\d+)/);
    if (!match || !match[1]) return null;

    const rideId = Number(match[1]);
    return Number.isNaN(rideId) ? null : rideId;
  }

  get unreadNotificationsCount(): number {
    return this.notifications.filter((notification: any) => !notification?.is_read).length;
  }

  markNotificationAsRead(notification: any, event?: Event): void {
    if (!notification?.id || notification?.is_read) return;

    this.service.markNotificationRead(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.map((item: any) =>
          item.id === notification.id ? { ...item, is_read: true } : item
        );
      },
      error: () => {
        if (event) {
          event.preventDefault();
        }
      },
    });
  }
}

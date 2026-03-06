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
  rideFeedItems: Array<{ type: 'notification' | 'message'; payload: any }> = [];
  showAllRideFeed = false;
  readonly rideFeedLimit = 5;
  expandedRideItems = new Set<string>();
  expandedGroupMessages = new Set<number>();

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
        this.buildRideFeedItems();
        this.showAllRideFeed = false;

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

    if (!Array.isArray(ride?.route_coords) || ride.route_coords.length === 0 || !ride?.from_city) {
      return 'Ride selected on map';
    }

    const fromCity = String(ride.from_city || '').trim();
    const toCity = String(ride.to_city || '').trim();
    if (!toCity || fromCity.toLowerCase() === toCity.toLowerCase()) {
      return fromCity;
    }

    return `${fromCity} -> ${toCity}`;
  }

  notificationTitle(notification: any): string {
    return notification?.title || 'Notification';
  }

  notificationMessage(notification: any): string {
    return notification?.message || '';
  }

  notificationRideCode(notification: any): string | null {
    const message = this.notificationMessage(notification);
    const match = message.match(/\/details-trip\/([A-Za-z0-9_-]+)/);
    if (!match || !match[1]) return null;

    const parsed = match[1];
    const rideId = Number(parsed);
    if (!Number.isNaN(rideId)) {
      const ride = this.ridesById.get(rideId);
      if (ride?.share_code) return String(ride.share_code);
    }
    return parsed;
  }

  canRespondToTaxiRequest(notification: any): boolean {
    return (
      notification?.notification_type === 'SERVICE_TAXI_REQUESTED' &&
      notification?.action_required === true &&
      !!notification?.service_taxi
    );
  }

  respondToTaxiRequest(notification: any, decision: 'ACCEPT' | 'REJECT', event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!notification?.service_taxi) return;

    this.service.respondToTaxiRequest(notification.service_taxi, decision).subscribe({
      next: () => {
        this.notifications = this.notifications.map((item: any) =>
          item.id === notification.id
            ? { ...item, is_read: true, action_required: false }
            : item
        );
        this.service.getNotifications().subscribe({
          next: (notifications) => {
            this.notifications = [...(notifications || [])].sort((a: any, b: any) => {
              const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
              const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
              return timeB - timeA;
            });
            this.buildRideFeedItems();
          },
          error: () => {
            // Keep local state if refresh fails.
          },
        });
      },
      error: (error) => {
        this.errorMessage = error?.error?.detail || error?.detail || 'Unable to respond to taxi request';
      },
    });
  }

  get unreadNotificationsCount(): number {
    return this.notifications.filter((notification: any) => !notification?.is_read).length;
  }

  get visibleRideFeedItems(): Array<{ type: 'notification' | 'message'; payload: any }> {
    if (this.showAllRideFeed) return this.rideFeedItems;
    return this.rideFeedItems.slice(0, this.rideFeedLimit);
  }

  get hasHiddenRideFeedItems(): boolean {
    return this.rideFeedItems.length > this.rideFeedLimit && !this.showAllRideFeed;
  }

  showMoreRideFeed(): void {
    this.showAllRideFeed = true;
  }

  markNotificationAsRead(notification: any, event?: Event): void {
    if (!notification?.id || notification?.is_read) return;

    this.service.markNotificationRead(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.map((item: any) =>
          item.id === notification.id ? { ...item, is_read: true } : item
        );
        this.buildRideFeedItems();
      },
      error: () => {
        if (event) {
          event.preventDefault();
        }
      },
    });
  }

  rideItemKey(item: any, type: 'notification' | 'message'): string {
    return type === 'notification' ? `n-${item?.id}` : `m-${item?.id}`;
  }

  isRideItemExpanded(item: any, type: 'notification' | 'message'): boolean {
    return this.expandedRideItems.has(this.rideItemKey(item, type));
  }

  toggleRideItem(item: any, type: 'notification' | 'message', event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const key = this.rideItemKey(item, type);
    if (this.expandedRideItems.has(key)) {
      this.expandedRideItems.delete(key);
    } else {
      this.expandedRideItems.add(key);
      if (type === 'notification') {
        this.markNotificationAsRead(item);
      }
    }
  }

  isGroupMessageExpanded(message: any): boolean {
    return this.expandedGroupMessages.has(message?.id);
  }

  toggleGroupMessage(message: any, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.expandedGroupMessages.has(message?.id)) {
      this.expandedGroupMessages.delete(message?.id);
    } else {
      this.expandedGroupMessages.add(message?.id);
    }
  }

  private buildRideFeedItems(): void {
    this.rideFeedItems = [
      ...this.notifications.map((notification: any) => ({
        type: 'notification' as const,
        payload: notification,
      })),
      ...this.notificationMessages.map((message: any) => ({
        type: 'message' as const,
        payload: message,
      })),
    ].sort((a, b) => this.itemTimestamp(b.payload) - this.itemTimestamp(a.payload));
  }

  private itemTimestamp(item: any): number {
    const rawDate = item?.created_at || item?.createdAt;
    if (!rawDate) return 0;
    const parsed = new Date(rawDate).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
}

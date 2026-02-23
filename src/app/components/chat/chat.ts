import { CommonModule, Location } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ServiceApi } from '../../services/service-api';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnInit {
  user: any | null = null;
  ride: any | null = null;
  messages: any[] = [];

  rideId: number | null = null;
  conversationId: number | null = null;
  messageText = '';

  loadingMessages = false;
  sendingMessage = false;
  loadingConversation = false;
  conversationResolved = false;
  errorMessage: string | null = null;

  constructor(
    private service: ServiceApi,
    private route: ActivatedRoute,
    private location: Location,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.rideId = Number.isNaN(id) ? null : id;

    if (this.rideId === null) {
      this.errorMessage = 'Invalid ride id';
      return;
    }

    this.loadCurrentUser();
    this.loadRideDetails();
  }

  goBack(): void {
    this.location.back();
  }

  loadCurrentUser() {
    this.service.getUser().subscribe({
      next: (user) => {
        this.user = user;
        this.tryResolveConversation();
      },
      error: (err) => {
        this.errorMessage = this.extractApiError(err, 'Unable to load current user');
      }
    });
  }

  loadRideDetails() {
    if (this.rideId === null) return;

    this.service.getRideDetails(this.rideId).subscribe({
      next: (ride) => {
        this.ride = ride;
        this.tryResolveConversation();
      },
      error: (err) => {
        this.errorMessage = this.extractApiError(err, 'Unable to load ride details');
      }
    });
  }

  tryResolveConversation() {
    if (this.conversationResolved || !this.user || !this.ride || this.rideId === null) return;
    this.conversationResolved = true;
    this.resolveConversation();
  }

  resolveConversation() {
    if (this.rideId === null || !this.user || !this.ride) return;

    this.loadingConversation = true;
    this.errorMessage = null;

    this.service.getConversations().subscribe({
      next: (conversations: any[]) => {
        const list = conversations || [];
        const conversation = this.findConversationByRide(list, this.rideId as number);

        if (conversation?.id) {
          this.conversationId = conversation.id;
          // this.messages = this.sortMessages(conversation.messages || []);
          this.loadingConversation = false;
          // this.cdr.detectChanges();
          this.loadMessages();
          return;
        }

        this.createConversationForRide();
      },
      error: (err) => {
        this.loadingConversation = false;
        this.errorMessage = this.extractApiError(err, 'Unable to load conversations');
      }
    });
  }

  findConversationByRide(conversations: any[], rideId: number): any | null {
    const conversation = conversations.find((item: any) => {
      const itemRideId = item.ride ?? item.ride_id ?? item.trip ?? item.trip_id;
      if (itemRideId !== rideId) return false;

      const participants = item.participants || item.members || [];
      if (Array.isArray(participants) && participants.length > 0) {
        return participants.includes(this.user?.id);
      }

      return true;
    });

    return conversation || null;
  }

  createConversationForRide() {
    if (this.rideId === null || !this.user) {
      this.loadingConversation = false;
      return;
    }

    const participantIds = [this.user.id, this.ride?.driver]
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index);

    const payload = {
      ride: this.rideId,
      participants: participantIds,
    };

    this.service.createConversation(payload).subscribe({
      next: (conversation) => {
        this.conversationId = conversation?.id;
        this.loadingConversation = false;

        if (!this.conversationId) {
          this.errorMessage = 'Conversation created but id is missing';
          return;
        }

        this.cdr.detectChanges();
        this.loadMessages();
      },
      error: (err) => {
        this.loadingConversation = false;
        this.errorMessage = this.extractApiError(err, 'Unable to create conversation for this ride');
      }
    });
  }

  loadMessages() {
    if (this.conversationId === null) return;

    this.loadingMessages = true;
    this.errorMessage = null;

    this.service.getMessages().subscribe({
      next: (data: any) => {
        const allMessages = this.extractList(data);
        this.messages = allMessages.filter(
          (message) =>
            Number(message.conversation ?? message.conversation_id ?? message.conversation?.id) === Number(this.conversationId)
        );

        this.messages = this.sortMessages(this.messages);

        this.loadingMessages = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = this.extractApiError(err, 'Unable to load messages');
        this.loadingMessages = false;
        this.cdr.detectChanges();
      }
    });
  }

  sendMessage() {
    const value = this.messageText.trim();
    if (!value || this.sendingMessage || this.conversationId === null || !this.user?.id) return;

    this.sendingMessage = true;
    this.errorMessage = null;

    const payload = {
      conversation: this.conversationId,
      sender: this.user.id,
      message_type: 'TEXT',
      content: value,
    };

    this.service.createMessage(payload).subscribe({
      next: (message) => {
        this.messages = this.sortMessages([...this.messages, message]);
        this.messageText = '';
        this.sendingMessage = false;
        // this.cdr.detectChanges();
        // this.loadMessages();
      },
      error: (err) => {
        const apiMessage = this.extractApiError(err, '');
        this.errorMessage = apiMessage || 'Unable to send message';
        this.sendingMessage = false;
        this.cdr.detectChanges();
      }
    });
  }

  extractApiError(error: any, fallback: string): string {
    const payload = error?.error;

    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    if (payload?.detail) {
      return String(payload.detail);
    }

    if (payload && typeof payload === 'object') {
      const firstKey = Object.keys(payload)[0];
      if (firstKey) {
        const value = payload[firstKey];
        if (Array.isArray(value) && value.length > 0) {
          return String(value[0]);
        }
        if (value) {
          return String(value);
        }
      }
    }

    if (error?.message) {
      return String(error.message);
    }

    return fallback;
  }

  extractList(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  }

  sortMessages(messages: any[]): any[] {
    return [...(messages || [])].sort((a, b) => {
      const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
      const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
      return timeA - timeB;
    });
  }

  isSentByMe(message: any): boolean {
    if (!this.user) return false;
    return message.sender === this.user.id || message.sender_id === this.user.id;
  }

  messageContent(message: any): string {
    return message.content || message.text || message.message || '';
  }

  messageAuthor(message: any): string {
    if (message.sender_username) return message.sender_username;
    if (message.sender?.username) return message.sender.username;
    if (message.sender_name) return message.sender_name;
    return 'Unknown';
  }

  messageTime(message: any): string {
    const rawDate = message.created_at || message.createdAt;
    if (!rawDate) return '';

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

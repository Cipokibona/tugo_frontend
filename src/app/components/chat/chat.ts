import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
  messages: any[] = [];

  conversationId: number | null = null;
  messageText = '';

  loadingMessages = false;
  sendingMessage = false;
  errorMessage: string | null = null;

  constructor(
    private service: ServiceApi,
    private route: ActivatedRoute,
    private location: Location,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.conversationId = Number.isNaN(id) ? null : id;

    this.loadCurrentUser();
    this.loadMessages();
  }

  goBack(): void {
    this.location.back();
  }

  loadCurrentUser() {
    this.service.getUser().subscribe({
      next: (user) => {
        this.user = user;
      },
      error: () => {
        this.errorMessage = 'Unable to load current user';
      }
    });
  }

  loadMessages() {
    this.loadingMessages = true;
    this.errorMessage = null;

    this.service.getMessages().subscribe({
      next: (data: any[]) => {
        const allMessages = data || [];

        if (this.conversationId !== null) {
          this.messages = allMessages.filter(
            (message) =>
              message.conversation === this.conversationId ||
              message.conversation_id === this.conversationId
          );
        } else {
          this.messages = allMessages;
        }

        this.messages = this.messages.sort((a, b) => {
          const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
          const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
          return timeA - timeB;
        });

        this.loadingMessages = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load messages';
        this.loadingMessages = false;
      }
    });
  }

  sendMessage() {
    const value = this.messageText.trim();
    if (!value || this.sendingMessage || this.conversationId === null) return;

    const payload = {
      conversation: this.conversationId,
      sender: this.user?.id,
      content: value,
    };

    this.sendingMessage = true;

    this.service.createMessage(payload).subscribe({
      next: (message) => {
        this.messages = [...this.messages, message];
        this.messageText = '';
        this.sendingMessage = false;
      },
      error: () => {
        this.errorMessage = 'Unable to send message';
        this.sendingMessage = false;
      }
    });
  }

  isSentByMe(message: any): boolean {
    if (!this.user) return false;
    return message.sender === this.user.id || message.sender_id === this.user.id;
  }

  messageContent(message: any): string {
    return message.content || message.text || message.message || '';
  }

  messageTime(message: any): string {
    const rawDate = message.created_at || message.createdAt;
    if (!rawDate) return '';

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

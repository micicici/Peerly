import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { displayAvatar } from '../../core/avatar';
import { formatInTimezone } from '../../core/zoned-time';
import { Store } from '@ngrx/store';
import { selectMe } from '../auth/auth.selectors';

type Conversation = {
  otherUser: {
    id: string;
    name: string;
    avatarUrl: string | null;
    gender: 'male' | 'female' | null;
  };
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    fromId: string;
  };
  unreadCount: number;
};

type ChatMessage = {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  createdAt: string;
};

@Component({
  selector: 'app-inbox',
  imports: [FormsModule],
  template: `
    <section class="inbox">
      <aside>
        <h1>Inbox</h1>
        @if (conversations().length === 0) {
          <p>No conversations yet. Start one from a teacher profile.</p>
        }
        @for (conversation of conversations(); track conversation.otherUser.id) {
          <button
            type="button"
            class="thread-row"
            [class.active]="activeId() === conversation.otherUser.id"
            (click)="open(conversation)"
          >
            <img
              class="avatar"
              [src]="avatar(conversation.otherUser)"
              alt=""
            />
            <span>
              <strong>{{ conversation.otherUser.name }}</strong>
              <span class="preview">{{ conversation.lastMessage.body }}</span>
            </span>
            @if (conversation.unreadCount > 0) {
              <span class="badge">{{ conversation.unreadCount }}</span>
            }
          </button>
        }
      </aside>
      <div class="reading">
        @if (active(); as person) {
          <h2>{{ person.name }}</h2>
          <div class="log">
            @for (message of messages(); track message.id) {
              <p [class.mine]="message.fromId === me()?.id">
                <span>{{ message.body }}</span>
                <span class="time">{{ formatTime(message.createdAt) }}</span>
              </p>
            }
          </div>
          <form (ngSubmit)="reply()">
            <textarea name="reply" [(ngModel)]="draft" required></textarea>
            <button type="submit">Send</button>
          </form>
        } @else {
          <p>Select a conversation to read messages.</p>
        }
      </div>
    </section>
  `,
  styleUrl: './inbox.page.css',
})
export class InboxPage {
  private readonly api = inject(ApiService);
  private readonly store = inject(Store);
  readonly me = this.store.selectSignal(selectMe);
  readonly conversations = signal<Conversation[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly activeId = signal<string | null>(null);
  readonly active = signal<Conversation['otherUser'] | null>(null);
  draft = '';

  constructor() {
    this.loadConversations();
  }

  avatar(person: Conversation['otherUser']): string {
    return displayAvatar(this.api.assetUrl(person.avatarUrl), person.gender);
  }

  formatTime(iso: string): string {
    return formatInTimezone(iso, this.me()?.timezone || 'UTC');
  }

  open(conversation: Conversation): void {
    this.activeId.set(conversation.otherUser.id);
    this.active.set(conversation.otherUser);
    this.api
      .get<ChatMessage[]>(`/messages?with=${conversation.otherUser.id}`)
      .subscribe({
        next: (rows) => {
          this.messages.set(rows);
          this.loadConversations();
        },
      });
  }

  reply(): void {
    const person = this.active();
    const body = this.draft.trim();
    if (!person || !body) {
      return;
    }
    this.api.post<ChatMessage>('/messages', { toId: person.id, body }).subscribe({
      next: (message) => {
        this.messages.update((rows) => [...rows, message]);
        this.draft = '';
        this.loadConversations();
      },
    });
  }

  private loadConversations(): void {
    this.api.get<Conversation[]>('/messages/conversations').subscribe({
      next: (rows) => this.conversations.set(rows),
      error: () => this.conversations.set([]),
    });
  }
}

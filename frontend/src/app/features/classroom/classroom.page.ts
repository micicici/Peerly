import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { P2P_TOKEN_KEY } from '../../core/auth.interceptor';
import { failureOf } from '../../core/http-error';
import { ClassroomPhase, ClassroomSession } from './classroom-session';
import { WhiteboardComponent } from './whiteboard';

type ClassroomAccess = {
  bookingId: string;
  role: 'teacher' | 'learner';
  startAt: string;
  endAt: string;
  peerName: string;
  offeringTitle: string;
};

@Component({
  selector: 'app-classroom',
  imports: [RouterLink, WhiteboardComponent],
  template: `
    @if (blocked()) {
      <section class="blocked">
        <h1>Classroom</h1>
        <p role="status">{{ error() }}</p>
        <a routerLink="/bookings">Back to bookings</a>
      </section>
    } @else {
      <section class="room">
        <header>
          <div>
            <p class="kicker">{{ access()?.offeringTitle || 'Class' }}</p>
            <h1>{{ peerLabel() }}</h1>
          </div>
          <p class="status" [class.live]="phase() === 'connected'" role="status">
            {{ statusLabel() }}
          </p>
        </header>
        <div class="stage" [class.split]="boardOpen()">
          <div class="video-pane">
            <video #remoteVideo autoplay playsinline></video>
            @if (phase() !== 'connected') {
              <p class="wait">{{ statusLabel() }}</p>
            } @else if (!remoteCamera()) {
              <p class="wait">Camera is off</p>
            }
            <video
              #localVideo
              class="pip"
              autoplay
              playsinline
              [muted]="true"
            ></video>
            @if (mediaReady() && !cameraOn()) {
              <p class="pip-off">Camera is off</p>
            }
            <span class="pip-label">You</span>
          </div>
          @if (session; as activeSession) {
            @if (boardOpen()) {
              <app-whiteboard [session]="activeSession" />
            }
          }
        </div>
        <div class="toolbar">
          <button
            type="button"
            [attr.aria-pressed]="!micOn()"
            [disabled]="!mediaReady()"
            (click)="session?.toggleMic()"
          >
            {{ micOn() ? 'Mute' : 'Unmute' }}
          </button>
          <button
            type="button"
            [attr.aria-pressed]="!cameraOn()"
            [disabled]="!mediaReady()"
            (click)="session?.toggleCamera()"
          >
            {{ cameraOn() ? 'Video off' : 'Video on' }}
          </button>
          <button
            type="button"
            [attr.aria-pressed]="sharing()"
            [disabled]="!mediaReady()"
            (click)="share()"
          >
            {{ sharing() ? 'Stop sharing' : 'Share screen' }}
          </button>
          <button
            type="button"
            [attr.aria-pressed]="boardOpen()"
            [disabled]="!ready()"
            (click)="toggleBoard()"
          >
            Toggle Whiteboard
          </button>
          <button type="button" class="leave" (click)="leave()">Leave Class</button>
        </div>
      </section>
    }
  `,
  styleUrl: './classroom.page.css',
})
export class ClassroomPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly localVideo =
    viewChild<ElementRef<HTMLVideoElement>>('localVideo');
  private readonly remoteVideo =
    viewChild<ElementRef<HTMLVideoElement>>('remoteVideo');

  readonly access = signal<ClassroomAccess | null>(null);
  readonly phase = signal<ClassroomPhase | 'checking'>('checking');
  readonly error = signal<string | null>(null);
  readonly blocked = signal(false);
  readonly micOn = signal(true);
  readonly cameraOn = signal(true);
  readonly sharing = signal(false);
  readonly remoteCamera = signal(true);
  readonly mediaReady = signal(false);
  readonly ready = signal(false);
  readonly boardOpen = signal(false);
  private readonly localStream = signal<MediaStream | null>(null);
  private readonly remoteStream = signal<MediaStream | null>(null);
  session: ClassroomSession | null = null;

  readonly peerLabel = computed(() => {
    const access = this.access();
    if (!access) {
      return 'Classroom';
    }
    const who = access.role === 'teacher' ? 'Student' : 'Teacher';
    return access.peerName ? `${who}: ${access.peerName}` : who;
  });

  readonly statusLabel = computed(() => {
    if (this.phase() === 'failed') {
      return 'The connection failed. Leave and join again.';
    }
    if (this.phase() === 'waiting') {
      return 'Waiting for the other participant to join...';
    }
    if (this.phase() === 'connected') {
      return 'Connected';
    }
    return 'Connecting...';
  });

  constructor() {
    afterRenderEffect(() => {
      this.paintVideo(this.localVideo()?.nativeElement, this.localStream(), true);
      this.paintVideo(this.remoteVideo()?.nativeElement, this.remoteStream(), false);
    });
    afterNextRender(() => this.enter());
  }

  ngOnDestroy(): void {
    this.releaseLocalMedia();
  }

  share(): void {
    void this.session?.toggleScreen().catch(() => {
      this.sharing.set(false);
    });
  }

  toggleBoard(): void {
    this.boardOpen.update((open) => !open);
  }

  leave(): void {
    this.releaseLocalMedia();
    void this.router.navigateByUrl('/bookings');
  }

  private enter(): void {
    const bookingId = this.route.snapshot.paramMap.get('bookingId');
    const token = localStorage.getItem(P2P_TOKEN_KEY);
    if (!bookingId || !token) {
      this.fail('You need to sign in to join this class.');
      return;
    }
    this.api
      .get<ClassroomAccess>(`/bookings/${bookingId}/classroom`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (access) => {
          this.access.set(access);
          this.ready.set(true);
          const session = new ClassroomSession(
            bookingId,
            token,
            this.api.baseUrl,
            {
              onPhase: (phase) => this.phase.set(phase),
              onError: (message) => this.fail(message),
              onLocalStream: (stream) => {
                this.mediaReady.set(stream !== null);
                this.localStream.set(stream);
                this.paintVideo(
                  this.localVideo()?.nativeElement,
                  stream,
                  true,
                );
              },
              onRemoteStream: (stream) => this.remoteStream.set(stream),
              onMic: (enabled) => this.micOn.set(enabled),
              onCamera: (enabled) => this.cameraOn.set(enabled),
              onScreenSharing: (sharing) => this.sharing.set(sharing),
              onRemoteCamera: (enabled) => this.remoteCamera.set(enabled),
            },
          );
          this.session = session;
          session.start();
        },
        error: (err: unknown) => {
          this.fail(failureOf(err).message);
        },
      });
  }

  private fail(message: string): void {
    this.releaseLocalMedia();
    this.error.set(message);
    this.blocked.set(true);
  }

  private paintVideo(
    el: HTMLVideoElement | undefined,
    stream: MediaStream | null,
    muted: boolean,
  ): void {
    if (!el) {
      return;
    }
    el.autoplay = true;
    el.playsInline = true;
    if (muted) {
      el.defaultMuted = true;
      el.muted = true;
    }
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    if (!stream) {
      return;
    }
    const start = () => {
      void el.play().catch(() => undefined);
    };
    el.onloadedmetadata = start;
    start();
  }

  private releaseLocalMedia(): void {
    const stream = this.localStream();
    this.session?.dispose();
    this.session = null;
    stream?.getTracks().forEach((track) => track.stop());
    this.localStream.set(null);
  }
}

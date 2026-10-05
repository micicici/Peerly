import { io, Socket } from 'socket.io-client';
import {
  WhiteboardModel,
  acceptPoints,
  acceptStroke,
  acceptStrokes,
} from './whiteboard-model';

export type ClassroomPhase = 'waiting' | 'connecting' | 'connected' | 'failed';

type SdpPayload = { type: RTCSdpType; sdp?: string };

type SessionEvents = {
  onPhase: (phase: ClassroomPhase) => void;
  onError: (message: string) => void;
  onLocalStream: (stream: MediaStream | null) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onMic: (enabled: boolean) => void;
  onCamera: (enabled: boolean) => void;
  onScreenSharing: (sharing: boolean) => void;
  onRemoteCamera: (enabled: boolean) => void;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

function liveTrack(tracks: MediaStreamTrack[]): MediaStreamTrack | null {
  return tracks.find((track) => track.readyState !== 'ended') ?? null;
}

export class ClassroomSession {
  private socket: Socket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private readonly deviceStreams: MediaStream[] = [];
  private screenStream: MediaStream | null = null;
  private micTrack: MediaStreamTrack | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private mediaTask: Promise<void> | null = null;
  private remoteStream = new MediaStream();
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private queuedOffer: SdpPayload | null = null;
  private role: 'teacher' | 'learner' | null = null;
  private wantOffer = false;
  private offerInFlight = false;
  private mediaReady = false;
  private disposed = false;
  private connectedOnce = false;
  readonly board = new WhiteboardModel();
  private readonly boardListeners = new Set<() => void>();

  constructor(
    private readonly bookingId: string,
    private readonly token: string,
    private readonly apiBaseUrl: string,
    private readonly events: SessionEvents,
  ) {}

  start(): void {
    void this.ensureMedia();
    this.socket = io(`${this.apiBaseUrl}/classroom`, {
      auth: { token: this.token },
    });
    this.bindBoard(this.socket);
    this.socket.on('connect', () => {
      this.connectedOnce = true;
      this.socket?.emit('join', { bookingId: this.bookingId });
    });
    this.socket.on('connect_error', () => {
      if (this.disposed || this.connectedOnce) {
        return;
      }
      this.events.onError('Unable to connect to the classroom.');
    });
    this.socket.on(
      'joined',
      (payload: {
        role: 'teacher' | 'learner';
        peerPresent: boolean;
        shouldOffer: boolean;
      }) => {
        this.role = payload.role;
        this.wantOffer = payload.shouldOffer;
        this.events.onPhase(payload.peerPresent ? 'connecting' : 'waiting');
        void this.ensureMedia();
      },
    );
    this.socket.on('peer-joined', () => {
      if (this.disposed) {
        return;
      }
      this.closePeer();
      this.queuedOffer = null;
      this.events.onRemoteStream(null);
      this.events.onRemoteCamera(true);
      this.events.onPhase('connecting');
      if (this.role === 'teacher') {
        this.wantOffer = true;
        void this.sendOffer();
      }
    });
    this.socket.on('peer-left', () => {
      if (this.disposed) {
        return;
      }
      this.closePeer();
      this.wantOffer = false;
      this.queuedOffer = null;
      this.events.onRemoteStream(null);
      this.events.onPhase('waiting');
    });
    this.socket.on('offer', (payload: { sdp?: SdpPayload }) => {
      if (payload.sdp) {
        void this.handleOffer(payload.sdp);
      }
    });
    this.socket.on('answer', (payload: { sdp?: SdpPayload }) => {
      if (payload.sdp) {
        void this.handleAnswer(payload.sdp);
      }
    });
    this.socket.on(
      'ice-candidate',
      (payload: { candidate?: RTCIceCandidateInit }) => {
        if (payload.candidate) {
          void this.addCandidate(payload.candidate);
        }
      },
    );
    this.socket.on('classroom-error', (payload: { message?: string }) => {
      this.events.onError(payload.message || 'You cannot join this class.');
    });
    this.socket.on('disconnect', (reason) => {
      if (this.disposed || reason === 'io client disconnect') {
        return;
      }
      this.closePeer();
      this.wantOffer = false;
      this.queuedOffer = null;
      this.events.onRemoteStream(null);
      this.events.onPhase('connecting');
    });
  }

  toggleMic(): void {
    if (!this.micTrack) {
      return;
    }
    this.micTrack.enabled = !this.micTrack.enabled;
    this.events.onMic(this.micTrack.enabled);
  }

  toggleCamera(): void {
    if (!this.cameraTrack || this.cameraTrack.readyState === 'ended') {
      void this.openCamera();
      return;
    }
    this.cameraTrack.enabled = !this.cameraTrack.enabled;
    this.events.onCamera(this.cameraTrack.enabled);
    if (!this.screenTrack) {
      this.events.onLocalStream(this.preview());
    }
  }

  async toggleScreen(): Promise<void> {
    if (this.screenTrack) {
      await this.stopScreenShare();
      return;
    }
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    if (this.disposed) {
      display.getTracks().forEach((track) => track.stop());
      return;
    }
    const track = display.getVideoTracks()[0];
    if (!track) {
      display.getTracks().forEach((item) => item.stop());
      return;
    }
    this.screenStream = display;
    this.screenTrack = track;
    track.addEventListener('ended', () => {
      void this.stopScreenShare();
    });
    await this.publishVideo(track);
    this.events.onScreenSharing(true);
    this.events.onLocalStream(this.preview());
  }

  subscribeBoard(listener: () => void): () => void {
    this.boardListeners.add(listener);
    return () => {
      this.boardListeners.delete(listener);
    };
  }

  sendBoard(
    event: 'whiteboard-begin' | 'whiteboard-points' | 'whiteboard-end',
    payload: unknown,
  ): void;
  sendBoard(event: 'whiteboard-clear'): void;
  sendBoard(event: string, payload?: unknown): void {
    if (this.disposed || !this.socket) {
      return;
    }
    if (payload === undefined) {
      this.socket.emit(event);
      return;
    }
    this.socket.emit(event, payload);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.socket?.emit('leave');
    this.socket?.disconnect();
    this.socket = null;
    this.releaseHardware();
    this.pc?.close();
    this.pc = null;
    this.events.onLocalStream(null);
    this.events.onRemoteStream(null);
  }

  private bindBoard(socket: Socket): void {
    socket.on('whiteboard-snapshot', (payload: { strokes?: unknown }) => {
      this.board.applySnapshot(acceptStrokes(payload?.strokes));
      this.touchBoard();
    });
    socket.on('whiteboard-begin', (payload: unknown) => {
      const stroke = acceptStroke(payload);
      if (!stroke) {
        return;
      }
      this.board.begin({ ...stroke, points: [] });
      this.touchBoard();
    });
    socket.on('whiteboard-points', (payload: { id?: unknown; points?: unknown }) => {
      if (!payload || typeof payload.id !== 'string') {
        return;
      }
      const points = acceptPoints(payload.points);
      if (points.length === 0) {
        return;
      }
      this.board.points(payload.id, points);
      this.touchBoard();
    });
    socket.on('whiteboard-clear', () => {
      this.board.clear();
      this.touchBoard();
    });
  }

  private touchBoard(): void {
    for (const listener of this.boardListeners) {
      listener();
    }
  }

  private ensureMedia(): Promise<void> {
    if (this.disposed) {
      return Promise.resolve();
    }
    if (this.mediaReady) {
      this.maybeOffer();
      return Promise.resolve();
    }
    if (!this.mediaTask) {
      this.mediaTask = this.acquireMedia().finally(() => {
        this.mediaTask = null;
      });
    }
    return this.mediaTask;
  }

  private async acquireMedia(): Promise<void> {
    if (this.mediaReady || this.disposed) {
      return;
    }
    const opened = await this.openDevices();
    if (!opened || this.disposed) {
      return;
    }
    this.localStream = opened.preview;
    this.micTrack = opened.audio;
    this.cameraTrack = opened.video;
    if (this.cameraTrack) {
      this.cameraTrack.enabled = true;
    }
    this.mediaReady = true;
    this.events.onMic(this.micTrack?.enabled ?? false);
    this.events.onCamera(this.cameraTrack !== null);
    this.events.onLocalStream(opened.preview);
    if (this.queuedOffer) {
      const offer = this.queuedOffer;
      this.queuedOffer = null;
      await this.handleOffer(offer);
      return;
    }
    this.maybeOffer();
  }

  private async openDevices(): Promise<{
    preview: MediaStream;
    audio: MediaStreamTrack | null;
    video: MediaStreamTrack | null;
  } | null> {
    try {
      const both = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      this.deviceStreams.push(both);
      if (this.disposed) {
        this.releaseHardware();
        return null;
      }
      const video = liveTrack(both.getVideoTracks());
      const audio = liveTrack(both.getAudioTracks());
      if (video) {
        return { preview: both, audio, video };
      }
      both.getTracks().forEach((track) => track.stop());
    } catch {
      // A combined request can fail when one device is busy. Open each device alone.
    }
    if (this.disposed) {
      return null;
    }

    let videoStream: MediaStream | null = null;
    let audioStream: MediaStream | null = null;
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
      this.deviceStreams.push(videoStream);
    } catch {
      videoStream = null;
    }
    if (this.disposed) {
      this.releaseHardware();
      return null;
    }
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.deviceStreams.push(audioStream);
    } catch {
      audioStream = null;
    }
    if (this.disposed) {
      this.releaseHardware();
      return null;
    }
    const video = liveTrack(videoStream?.getVideoTracks() ?? []);
    const audio = liveTrack(audioStream?.getAudioTracks() ?? []);
    if (!audio) {
      this.releaseHardware();
      this.events.onError('Allow the microphone to join the class.');
      return null;
    }
    return {
      preview: videoStream ?? audioStream!,
      audio,
      video,
    };
  }

  private async openCamera(): Promise<void> {
    if (this.disposed) {
      return;
    }
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
      const video = liveTrack(videoStream.getVideoTracks());
      if (this.disposed || !video) {
        videoStream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.deviceStreams.push(videoStream);
      this.cameraTrack = video;
      video.enabled = true;
      if (!this.localStream || this.localStream.getVideoTracks().length === 0) {
        this.localStream = videoStream;
      }
      this.events.onCamera(true);
      this.events.onLocalStream(this.preview());
      await this.publishVideo(video);
    } catch {
      this.events.onCamera(false);
    }
  }

  private maybeOffer(): void {
    if (this.wantOffer) {
      void this.sendOffer();
    }
  }

  private async sendOffer(): Promise<void> {
    if (
      this.disposed ||
      !this.mediaReady ||
      this.role !== 'teacher' ||
      !this.wantOffer ||
      this.offerInFlight
    ) {
      return;
    }
    const pc = this.ensurePc();
    if (pc.signalingState !== 'stable') {
      return;
    }
    this.offerInFlight = true;
    this.wantOffer = false;
    try {
      this.events.onPhase('connecting');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket?.emit('offer', {
        sdp: { type: offer.type, sdp: offer.sdp },
      });
    } catch {
      this.wantOffer = true;
      this.events.onPhase('failed');
    } finally {
      this.offerInFlight = false;
    }
  }

  private async handleOffer(sdp: SdpPayload): Promise<void> {
    if (this.disposed) {
      return;
    }
    if (this.role === 'teacher' && this.pc?.signalingState === 'have-local-offer') {
      return;
    }
    if (!this.mediaReady) {
      this.queuedOffer = sdp;
      return;
    }
    const pc = this.ensurePc();
    this.events.onPhase('connecting');
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.flushCandidates();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.socket?.emit('answer', {
      sdp: { type: answer.type, sdp: answer.sdp },
    });
  }

  private async handleAnswer(sdp: SdpPayload): Promise<void> {
    if (!this.pc || this.disposed) {
      return;
    }
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.flushCandidates();
  }

  private async addCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async flushCandidates(): Promise<void> {
    if (!this.pc?.remoteDescription) {
      return;
    }
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private ensurePc(): RTCPeerConnection {
    if (this.pc && this.pc.connectionState !== 'closed') {
      return this.pc;
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    this.remoteStream = new MediaStream();
    const audio = this.micTrack;
    const video = this.screenTrack ?? this.cameraTrack;
    if (audio) {
      pc.addTrack(audio);
    }
    if (video) {
      pc.addTrack(video);
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket?.emit('ice-candidate', {
          candidate: event.candidate.toJSON(),
        });
      }
    };
    pc.ontrack = (event) => {
      this.remoteStream.addTrack(event.track);
      this.events.onRemoteStream(this.remoteStream);
      if (event.track.kind === 'video') {
        const update = () => {
          this.events.onRemoteCamera(!event.track.muted);
        };
        event.track.onmute = update;
        event.track.onunmute = update;
        event.track.onended = () => this.events.onRemoteCamera(false);
        update();
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) {
        return;
      }
      if (pc.connectionState === 'connected') {
        this.events.onPhase('connected');
      } else if (pc.connectionState === 'failed') {
        this.events.onPhase('failed');
      } else if (
        pc.connectionState === 'connecting' ||
        pc.connectionState === 'disconnected'
      ) {
        this.events.onPhase('connecting');
      }
    };
    return pc;
  }

  private async publishVideo(track: MediaStreamTrack | null): Promise<void> {
    if (!this.pc || this.pc.connectionState === 'closed') {
      return;
    }
    const sender = this.pc
      .getSenders()
      .find((item) => item.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(track);
      return;
    }
    if (!track) {
      return;
    }
    this.pc.addTrack(track);
    await this.renegotiate();
  }

  private async renegotiate(): Promise<void> {
    if (
      !this.pc ||
      this.pc.signalingState !== 'stable' ||
      this.offerInFlight ||
      this.disposed
    ) {
      return;
    }
    this.offerInFlight = true;
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.socket?.emit('offer', {
        sdp: { type: offer.type, sdp: offer.sdp },
      });
    } finally {
      this.offerInFlight = false;
    }
  }

  private async stopScreenShare(): Promise<void> {
    const display = this.screenStream;
    if (!display || this.disposed) {
      return;
    }
    this.screenStream = null;
    this.screenTrack = null;
    display.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    if (this.cameraTrack && this.pc) {
      await this.publishVideo(this.cameraTrack);
    }
    this.events.onScreenSharing(false);
    this.events.onLocalStream(this.localStream ?? this.preview());
  }

  private releaseHardware(): void {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    for (const stream of this.deviceStreams) {
      stream.getTracks().forEach((track) => track.stop());
    }
    this.deviceStreams.length = 0;
    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.screenStream = null;
    this.micTrack?.stop();
    this.cameraTrack?.stop();
    this.screenTrack?.stop();
    this.micTrack = null;
    this.cameraTrack = null;
    this.screenTrack = null;
  }

  private preview(): MediaStream {
    const stream = new MediaStream();
    if (this.micTrack) {
      stream.addTrack(this.micTrack);
    }
    const video = this.screenTrack ?? this.cameraTrack;
    if (video) {
      stream.addTrack(video);
    }
    return stream;
  }

  private closePeer(): void {
    this.pendingCandidates = [];
    this.pc?.close();
    this.pc = null;
    this.remoteStream = new MediaStream();
  }
}

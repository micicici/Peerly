import { ClassroomSession } from './classroom-session';

function track(kind: 'audio' | 'video'): MediaStreamTrack {
  return {
    kind,
    enabled: true,
    readyState: 'live',
    stop: jasmine.createSpy(`${kind}.stop`),
    addEventListener: jasmine.createSpy('addEventListener'),
  } as unknown as MediaStreamTrack;
}

function streamOf(...tracks: MediaStreamTrack[]): MediaStream {
  const stream = new MediaStream();
  spyOn(stream, 'getTracks').and.returnValue(tracks);
  spyOn(stream, 'getAudioTracks').and.returnValue(
    tracks.filter((item) => item.kind === 'audio'),
  );
  spyOn(stream, 'getVideoTracks').and.returnValue(
    tracks.filter((item) => item.kind === 'video'),
  );
  return stream;
}

describe('ClassroomSession media', () => {
  let audio: MediaStreamTrack;
  let video: MediaStreamTrack;
  let stream: MediaStream;
  let local: MediaStream | null;

  beforeEach(() => {
    audio = track('audio');
    video = track('video');
    stream = streamOf(audio, video);
    local = null;
  });

  function session(): ClassroomSession {
    return new ClassroomSession('booking-1', 'token', 'http://localhost:3000', {
      onPhase: () => undefined,
      onError: () => undefined,
      onLocalStream: (next) => {
        local = next;
      },
      onRemoteStream: () => undefined,
      onMic: () => undefined,
      onCamera: () => undefined,
      onScreenSharing: () => undefined,
      onRemoteCamera: () => undefined,
    });
  }

  it('shows the local camera before a peer joins', async () => {
    spyOn(navigator.mediaDevices, 'getUserMedia').and.resolveTo(stream);
    const room = session();
    room.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(local).toBe(stream);
    room.dispose();
  });

  it('stops every track on leave, including a stream granted after dispose', async () => {
    let grant: ((value: MediaStream) => void) | undefined;
    spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(
      new Promise<MediaStream>((resolve) => {
        grant = resolve;
      }),
    );
    const room = session();
    room.start();
    await Promise.resolve();
    room.dispose();
    grant!(stream);
    await Promise.resolve();
    await Promise.resolve();

    expect(audio.stop).toHaveBeenCalled();
    expect(video.stop).toHaveBeenCalled();
    expect(local).toBeNull();
  });

  it('shows the camera when opening the microphone and camera together fails', async () => {
    const camera = streamOf(video);
    const mic = streamOf(audio);
    spyOn(navigator.mediaDevices, 'getUserMedia').and.callFake(
      (constraints?: MediaStreamConstraints) => {
        if (constraints?.audio && constraints?.video) {
          return Promise.reject(new DOMException('busy', 'NotReadableError'));
        }
        if (constraints?.video) {
          return Promise.resolve(camera);
        }
        return Promise.resolve(mic);
      },
    );
    const room = session();
    room.start();
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
    }

    expect(local).toBe(camera);
    room.dispose();
    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
  });

  it('stops the camera and microphone when the room is disposed', async () => {
    spyOn(navigator.mediaDevices, 'getUserMedia').and.resolveTo(stream);
    const room = session();
    room.start();
    await Promise.resolve();
    await Promise.resolve();
    room.dispose();

    expect(audio.stop).toHaveBeenCalled();
    expect(video.stop).toHaveBeenCalled();
    expect(local).toBeNull();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { P2P_TOKEN_KEY } from '../../core/auth.interceptor';
import { ClassroomPage } from './classroom.page';

function mediaStream(): { stream: MediaStream; stop: jasmine.Spy } {
  const stop = jasmine.createSpy('stop');
  const video = {
    kind: 'video',
    enabled: true,
    stop,
  } as unknown as MediaStreamTrack;
  const audio = {
    kind: 'audio',
    enabled: true,
    stop,
  } as unknown as MediaStreamTrack;
  const stream = new MediaStream();
  spyOn(stream, 'getTracks').and.returnValue([audio, video]);
  spyOn(stream, 'getAudioTracks').and.returnValue([audio]);
  spyOn(stream, 'getVideoTracks').and.returnValue([video]);
  return { stream, stop };
}

describe('ClassroomPage media', () => {
  let fixture: ComponentFixture<ClassroomPage>;
  let stream: MediaStream;
  let stop: jasmine.Spy;

  beforeEach(async () => {
    const media = mediaStream();
    stream = media.stream;
    stop = media.stop;
    spyOn(navigator.mediaDevices, 'getUserMedia').and.resolveTo(stream);
    localStorage.setItem(P2P_TOKEN_KEY, 'token');

    await TestBed.configureTestingModule({
      imports: [ClassroomPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ bookingId: 'booking-1' }) },
          },
        },
        {
          provide: ApiService,
          useValue: {
            baseUrl: 'http://127.0.0.1:9',
            get: () =>
              of({
                bookingId: 'booking-1',
                role: 'learner',
                startAt: '2026-10-04T12:00:00.000Z',
                endAt: '2026-10-04T13:00:00.000Z',
                peerName: 'Ada',
                offeringTitle: 'Guitar',
              }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassroomPage);
  });

  afterEach(() => {
    localStorage.removeItem(P2P_TOKEN_KEY);
    fixture.destroy();
  });

  it('binds the local camera before a peer joins and stops it on destroy', async () => {
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const video = fixture.nativeElement.querySelector(
      'video.pip',
    ) as HTMLVideoElement;
    expect(video.srcObject).toBe(stream);

    fixture.componentInstance.ngOnDestroy();
    expect(stop).toHaveBeenCalled();
  });
});

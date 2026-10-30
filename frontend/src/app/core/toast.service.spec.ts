import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('clears the banner 5 seconds after it is shown', fakeAsync(() => {
    const toast = TestBed.inject(ToastService);
    toast.show('Email format is invalid', 'FORBIDDEN');

    tick(4999);
    expect(toast.message()).toBe('Email format is invalid');

    tick(1);
    expect(toast.message()).toBeNull();
    expect(toast.code()).toBeNull();
  }));

  it('restarts the timer when a new banner replaces the current one', fakeAsync(() => {
    const toast = TestBed.inject(ToastService);
    toast.show('First');
    tick(4000);
    toast.show('Second');
    tick(4000);
    expect(toast.message()).toBe('Second');
    tick(1000);
    expect(toast.message()).toBeNull();
  }));
});

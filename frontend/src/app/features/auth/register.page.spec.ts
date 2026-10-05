import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { RegisterPage } from './register.page';

describe('RegisterPage validation', () => {
  let fixture: ComponentFixture<RegisterPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            auth: {
              token: null,
              me: null,
              status: 'idle',
              errorCode: null,
            },
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows a warning when the email is not a valid address', () => {
    fixture.componentInstance.form.controls.email.setValue('not-an-email');
    fixture.componentInstance.form.controls.email.markAsTouched();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Enter a valid email address.',
    );
  });

  it('shows a warning when a required field is missing', () => {
    fixture.componentInstance.submit();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Name is required.');
    expect(text).toContain('Email is required.');
  });
});

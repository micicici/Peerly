import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { SubjectInputComponent } from './subject-input';

@Component({
  imports: [SubjectInputComponent, ReactiveFormsModule],
  template: `<app-subject-input [control]="control" />`,
})
class HostComponent {
  readonly control = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
}

describe('SubjectInputComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: ApiService,
          useValue: { get: () => of([]) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('shows Subject is required after a submit with no subject', () => {
    fixture.componentInstance.control.markAsTouched();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Subject is required',
    );
  });

  it('hides the error once a subject is entered', () => {
    const control = fixture.componentInstance.control;
    control.markAsTouched();
    control.setValue('Math');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Subject is required',
    );
  });
});

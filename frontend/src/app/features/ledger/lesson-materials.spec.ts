import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LessonMaterials } from './lesson-materials';

describe('LessonMaterials', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(canAttach: boolean, materials: { id: string; originalName: string }[]) {
    await TestBed.configureTestingModule({
      imports: [LessonMaterials, HttpClientTestingModule],
    }).compileComponents();
    const fixture = TestBed.createComponent(LessonMaterials);
    fixture.componentInstance.bookingId = 'b1';
    fixture.componentInstance.canAttach = canAttach;
    fixture.componentInstance.materials = materials;
    fixture.detectChanges();
    return {
      el: fixture.nativeElement as HTMLElement,
      fixture,
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('shows Attach Material for the teacher and posts the file', async () => {
    const { el, http } = await render(true, []);
    const input = el.querySelector('input[type="file"]') as HTMLInputElement;
    expect(el.textContent).toContain('Attach Material');
    const file = new File(['notes'], 'homework.pdf', { type: 'application/pdf' });
    const list = {
      0: file,
      length: 1,
      item: () => file,
    } as unknown as FileList;
    Object.defineProperty(input, 'files', { value: list });
    input.dispatchEvent(new Event('change'));
    const req = http.expectOne('http://localhost:3000/bookings/b1/materials');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    req.flush([]);
    http.verify();
  });

  it('shows Download Material for shared files and hides attach for students', async () => {
    const { el } = await render(false, [{ id: 'm1', originalName: 'homework.pdf' }]);
    expect(el.querySelector('input[type="file"]')).toBeNull();
    expect(el.textContent).toContain('Download Material');
    expect(el.textContent).toContain('homework.pdf');
  });
});

import { TestBed } from '@angular/core/testing';
import { StarRatingComponent } from './star-rating';

describe('StarRatingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StarRatingComponent],
    }).compileComponents();
  });

  function render(rating: number): HTMLElement {
    const fixture = TestBed.createComponent(StarRatingComponent);
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('fills rounded stars in amber and outlines the rest', () => {
    const el = render(3.2);
    const stars = el.querySelectorAll('.star');
    expect(stars.length).toBe(5);
    expect(stars[0].classList.contains('filled')).toBe(true);
    expect(stars[2].classList.contains('filled')).toBe(true);
    expect(stars[3].classList.contains('empty')).toBe(true);
    expect(stars[4].getAttribute('fill') ?? stars[4].querySelector('path')?.getAttribute('fill')).toBe(
      'none',
    );
    expect(getComputedStyle(stars[0]).color).toBe('rgb(245, 158, 11)');
    expect(getComputedStyle(stars[4]).color).toBe('rgb(214, 211, 209)');
    expect(el.querySelector('.stars')?.getAttribute('aria-label')).toBe('3 out of 5 stars');
  });

  it('renders five outlined stars when there are no ratings', () => {
    const el = render(0);
    expect(el.querySelectorAll('.star.filled').length).toBe(0);
    expect(el.querySelectorAll('.star.empty').length).toBe(5);
    expect(el.querySelector('.stars')?.getAttribute('aria-label')).toBe('No ratings yet');
  });
});

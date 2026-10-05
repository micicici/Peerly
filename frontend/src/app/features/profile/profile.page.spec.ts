import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { OfferingsActions } from '../offerings/offerings.actions';
import { ProfilePage } from './profile.page';

function clickButton(el: HTMLElement, label: string): void {
  const button = Array.from(el.querySelectorAll('button')).find(
    (node) => node.textContent?.trim() === label,
  );
  if (!button) {
    throw new Error(`Missing button ${label}`);
  }
  button.click();
}

describe('ProfilePage offerings', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function render(): Promise<{
    el: HTMLElement;
    fixture: { detectChanges: () => void; componentInstance: ProfilePage };
    store: Store;
    http: HttpTestingController;
  }> {
    await TestBed.configureTestingModule({
      imports: [ProfilePage, HttpClientTestingModule],
      providers: [
        provideMockActions(() => new Subject()),
        provideMockStore({
          initialState: {
            auth: {
              token: 't',
              me: {
                id: 'me',
                email: 'a@b.c',
                name: 'Ada',
                bio: 'I teach guitar and piano.',
                avatarUrl: null,
                gender: 'female',
                yearOfBirth: 1990,
                spokenLanguages: ['English'],
                timezone: 'UTC',
                balance: 3,
                offeringCount: 1,
              },
              status: 'idle',
              errorCode: null,
            },
            offerings: {
              ids: ['o1'],
              entities: {
                o1: {
                  id: 'o1',
                  teacherId: 'me',
                  title: 'Guitar',
                  description: 'Chords and songs',
                  level: 'beginner',
                  createdAt: '2026-09-25T00:00:00.000Z',
                  subjectId: 'music',
                  subjectName: 'Music',
                },
              },
              status: 'idle',
              errorCode: null,
            },
            ledger: {
              ids: [],
              entities: {},
              status: 'idle',
              errorCode: null,
            },
          },
        }),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement as HTMLElement,
      fixture,
      store: TestBed.inject(Store),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('opens an edit dialog prefilled with the offering and saves it', async () => {
    const { el, fixture, store, http } = await render();
    const spy = spyOn(store, 'dispatch');
    clickButton(el, 'Edit');
    fixture.detectChanges();
    http.expectOne('http://localhost:3000/subjects').flush([]);
    fixture.detectChanges();

    const title = el.querySelector(
      'input[formcontrolname="title"]',
    ) as HTMLInputElement;
    const description = el.querySelector(
      'textarea[formcontrolname="description"]',
    ) as HTMLTextAreaElement;
    expect(title.value).toBe('Guitar');
    expect(description.value).toBe('Chords and songs');
    expect(
      (el.querySelector('select[formcontrolname="level"]') as HTMLSelectElement).value,
    ).toBe('beginner');

    fixture.componentInstance.editForm.controls.title.setValue('Updated guitar');
    fixture.componentInstance.saveEdit();
    expect(spy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: OfferingsActions.update.type,
        id: 'o1',
        title: 'Updated guitar',
        description: 'Chords and songs',
        subjectName: 'Music',
        level: 'beginner',
      }),
    );
  });

  it('asks before deleting and only then removes the offering', async () => {
    const { el, fixture, store } = await render();
    const spy = spyOn(store, 'dispatch');
    clickButton(el, 'Delete');
    fixture.detectChanges();
    expect(el.textContent).toContain(
      'Delete this offering? It will be removed from your profile and the catalog.',
    );
    expect(spy).not.toHaveBeenCalledWith(
      jasmine.objectContaining({ type: OfferingsActions.remove.type }),
    );
    clickButton(el, 'Delete offering');
    expect(spy).toHaveBeenCalledWith(OfferingsActions.remove({ id: 'o1' }));
  });
});

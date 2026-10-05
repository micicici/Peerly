import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { OfferingLevel } from '../offerings/offerings.actions';

export type SearchQuery = {
  q: string;
  level: OfferingLevel | '';
  languages: string[];
  subjectIds: string[];
};

export function subjectOptionsFromOfferings(
  offerings: { subjectId: string | null; subjectName: string | null }[],
): { id: string; name: string }[] {
  const byId = new Map<string, { id: string; name: string }>();
  for (const offering of offerings) {
    const name = offering.subjectName?.trim();
    if (!offering.subjectId || !name) {
      continue;
    }
    byId.set(offering.subjectId, { id: offering.subjectId, name });
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

@Component({
  selector: 'app-search-bar',
  imports: [ReactiveFormsModule],
  template: `
    <form class="filters" [formGroup]="form" (ngSubmit)="submit()">
      <div class="search-row">
        <label class="grow">
          Search by lesson type or teacher name
          <input type="search" formControlName="q" placeholder="Mathematics, Ada…" />
        </label>
        <label>
          Level
          <select formControlName="level">
            <option value="">Any level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <button
          type="button"
          class="icon-btn"
          [attr.aria-expanded]="filtersOpen()"
          aria-label="Filter by spoken languages and subjects"
          (click)="toggleFilters()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 5h16l-6 7v5l-4 2v-7L4 5z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button type="submit">Search</button>
      </div>
      @if (filtersOpen()) {
        <div class="filter-menu">
          <fieldset>
            <legend>Spoken languages</legend>
            @for (language of languages(); track language) {
              <label class="check">
                <input
                  type="checkbox"
                  [checked]="selectedLanguages().has(language)"
                  (change)="toggleLanguage(language)"
                />
                {{ language }}
              </label>
            } @empty {
              <p>No languages have been added by users yet.</p>
            }
          </fieldset>
          <fieldset>
            <legend>Subjects</legend>
            @for (subject of subjects(); track subject.id) {
              <label class="check">
                <input
                  type="checkbox"
                  [checked]="selectedSubjects().has(subject.id)"
                  (change)="toggleSubject(subject.id)"
                />
                {{ subject.name }}
              </label>
            } @empty {
              <p>No subjects yet.</p>
            }
          </fieldset>
          <p class="meta">Matches any selected language and any selected subject.</p>
        </div>
      }
    </form>
  `,
  styleUrl: './search-bar.css',
})
export class SearchBarComponent {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly value = input<SearchQuery>({
    q: '',
    level: '',
    languages: [],
    subjectIds: [],
  });
  readonly knownSubjects = input<{ id: string; name: string }[]>([]);
  readonly search = output<SearchQuery>();

  readonly filtersOpen = signal(false);
  readonly languages = signal<string[]>([]);
  private readonly loadedSubjects = signal<{ id: string; name: string }[]>([]);
  readonly subjects = computed(() =>
    mergeSubjects(this.loadedSubjects(), this.knownSubjects()),
  );
  readonly selectedLanguages = signal<ReadonlySet<string>>(new Set());
  readonly selectedSubjects = signal<ReadonlySet<string>>(new Set());

  readonly form = this.fb.nonNullable.group({
    q: [''],
    level: this.fb.nonNullable.control<OfferingLevel | ''>(''),
  });

  constructor() {
    effect(() => {
      const value = this.value();
      this.form.setValue(
        { q: value.q, level: value.level },
        { emitEvent: false },
      );
      this.selectedLanguages.set(new Set(value.languages));
      this.selectedSubjects.set(new Set(value.subjectIds));
    });
    this.loadSubjects();
  }

  toggleFilters(): void {
    const open = !this.filtersOpen();
    this.filtersOpen.set(open);
    if (!open) {
      return;
    }
    this.loadLanguages();
    this.loadSubjects();
  }

  private loadLanguages(): void {
    this.api
      .get<string[]>('/languages')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.languages.set(rows),
        error: () => this.languages.set([]),
      });
  }

  private loadSubjects(): void {
    this.api
      .get<{ id: string; name: string }[]>('/subjects')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.loadedSubjects.set(rows),
        error: () => this.loadedSubjects.set([]),
      });
  }

  toggleLanguage(language: string): void {
    this.selectedLanguages.update((current) => toggleSet(current, language));
  }

  toggleSubject(id: string): void {
    this.selectedSubjects.update((current) => toggleSet(current, id));
  }

  submit(): void {
    const { q, level } = this.form.getRawValue();
    this.search.emit({
      q,
      level,
      languages: [...this.selectedLanguages()],
      subjectIds: [...this.selectedSubjects()],
    });
  }
}

function toggleSet(current: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(current);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function mergeSubjects(
  ...groups: { id: string; name: string }[][]
): { id: string; name: string }[] {
  const byId = new Map<string, { id: string; name: string }>();
  for (const group of groups) {
    for (const subject of group) {
      const name = subject.name?.trim();
      if (!subject.id || !name) {
        continue;
      }
      byId.set(subject.id, { id: subject.id, name });
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectMe } from '../auth/auth.selectors';
import { OfferingLevel } from '../offerings/offerings.actions';
import { CatalogActions } from './catalog.actions';
import {
  selectCatalogOfferings,
  selectCatalogStatus,
} from './catalog.selectors';
import { SearchBarComponent, SearchQuery, subjectOptionsFromOfferings } from './search-bar';
import { pastelsForSubjects, subjectColorKey } from '../../core/subject-pastel';

@Component({
  selector: 'app-subjects',
  imports: [RouterLink, SearchBarComponent],
  template: `
    <section>
      <h1>Subjects</h1>
      <app-search-bar
        [value]="query()"
        [knownSubjects]="knownSubjects()"
        (search)="onSearch($event)"
      />
      @if (status() === 'loading' && offerings().length === 0) {
        <p>Loading offerings…</p>
      }
      <div class="cards">
        @for (offering of offerings(); track offering.id) {
          <article
            class="card lesson-card"
            [style.background-color]="pastel(offering.subjectName).background"
            [style.border-color]="pastel(offering.subjectName).border"
            [style.border-top-color]="pastel(offering.subjectName).accent"
          >
            <h2>
              <a
                [routerLink]="['/teachers', offering.teacherId]"
                [queryParams]="{ offeringId: offering.id }"
              >{{ offering.title }}</a>
            </h2>
            <p class="meta">
              {{ offering.subjectName || 'Subject' }} · {{ offering.teacherName }} ·
              {{ offering.level }}
            </p>
            <p>{{ offering.description }}</p>
            <p class="meta">{{ offering.openSlotCount }} open slots</p>
            @if (offering.teacherId !== me()?.id) {
              <a
                class="button-link"
                [routerLink]="['/teachers', offering.teacherId]"
                [queryParams]="{ offeringId: offering.id }"
              >View schedule</a>
            }
          </article>
        }
      </div>
    </section>
  `,
  styleUrl: './catalog.page.css',
})
export class SubjectsPage {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly me = this.store.selectSignal(selectMe);
  readonly offerings = this.store.selectSignal(selectCatalogOfferings);
  readonly status = this.store.selectSignal(selectCatalogStatus);
  readonly query = signal<SearchQuery>({
    q: '',
    level: '',
    languages: [],
    subjectIds: [],
  });
  readonly knownSubjects = computed(() => subjectOptionsFromOfferings(this.offerings()));
  private readonly pastelBySubject = computed(() =>
    pastelsForSubjects(this.offerings().map((offering) => offering.subjectName)),
  );

  pastel(subjectName: string | null | undefined) {
    return this.pastelBySubject().get(subjectColorKey(subjectName))!;
  }

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const level = params.get('level') ?? '';
      const next: SearchQuery = {
        q: params.get('q') ?? '',
        level: isLevel(level) ? level : '',
        languages: splitParam(params.get('languages')),
        subjectIds: splitParam(params.get('subjects')),
      };
      this.query.set(next);
      this.store.dispatch(CatalogActions.browse(next));
    });
  }

  onSearch(filters: SearchQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: filters.q || null,
        level: filters.level || null,
        languages: filters.languages.join(',') || null,
        subjects: filters.subjectIds.join(',') || null,
      },
    });
  }
}

function splitParam(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function isLevel(value: string): value is OfferingLevel {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced';
}

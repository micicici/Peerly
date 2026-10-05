import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { ApiService } from '../../core/api.service';
import { displayAvatar } from '../../core/avatar';
import { pastelForSubject, pastelsForSubjects, subjectColorKey } from '../../core/subject-pastel';
import { selectIsAuthed } from '../auth/auth.selectors';
import { CatalogOffering } from '../catalog/catalog.actions';
import {
  SearchBarComponent,
  SearchQuery,
  subjectOptionsFromOfferings,
} from '../catalog/search-bar';
import { StarRatingComponent } from '../ratings/star-rating';

type PopularTeacher = {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  gender: 'male' | 'female' | null;
  avgRating: number;
  ratingCount: number;
  completedCount: number;
};

@Component({
  selector: 'app-home',
  imports: [RouterLink, SearchBarComponent, StarRatingComponent],
  template: `
    <section>
      <h1>Learn by teaching</h1>
      <p class="lede">
        Browse classes and teachers. Book a session or publish an offering after you log in.
      </p>
      <app-search-bar [knownSubjects]="knownSubjects()" (search)="onSearch($event)" />
      <h2>Popular classes</h2>
      @if (classes().length === 0) {
        <p>No classes yet.</p>
      }
      <div class="cards">
        @for (offering of classes(); track offering.id) {
          <article
            class="card lesson-card"
            [style.background-color]="pastel(offering.subjectName).background"
            [style.border-color]="pastel(offering.subjectName).border"
            [style.border-top-color]="pastel(offering.subjectName).accent"
          >
            <h2>
              <a [routerLink]="['/teachers', offering.teacherId]" [queryParams]="{ offeringId: offering.id }">
                {{ offering.title }}
              </a>
            </h2>
            <p class="meta">
              {{ offering.subjectName || 'Subject' }} · {{ offering.teacherName }} ·
              {{ offering.level }}
            </p>
            <p>{{ offering.description }}</p>
            <p class="meta">
              {{ offering.openSlotCount }} open slots ·
              <app-star-rating [rating]="offering.avgRating" />
              ({{ offering.ratingCount }})
            </p>
          </article>
        }
      </div>
      <h2>Popular teachers</h2>
      <div class="cards">
        @for (teacher of teachers(); track teacher.id) {
          <article class="card">
            <h2>
              <a [routerLink]="['/teachers', teacher.id]">{{ teacher.name }}</a>
            </h2>
            <img class="avatar" [src]="avatar(teacher)" alt="" />
            <p>{{ teacher.bio }}</p>
            <p class="meta">
              <app-star-rating [rating]="teacher.avgRating" />
              · {{ teacher.completedCount }} completed classes
            </p>
          </article>
        }
      </div>
      @if (!authed()) {
        <p class="lede">
          <a routerLink="/register">Create an account</a> to book hours and teach.
        </p>
      }
    </section>
  `,
  styleUrls: ['../catalog/catalog.page.css', './home.page.css'],
})
export class HomePage {
  private readonly api = inject(ApiService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  readonly authed = this.store.selectSignal(selectIsAuthed);
  readonly classes = signal<(CatalogOffering & { avgRating: number; ratingCount: number })[]>([]);
  readonly teachers = signal<PopularTeacher[]>([]);
  readonly knownSubjects = computed(() => subjectOptionsFromOfferings(this.classes()));
  private readonly pastelBySubject = computed(() =>
    pastelsForSubjects(this.classes().map((offering) => offering.subjectName)),
  );

  constructor() {
    this.api
      .get<{
        popularClasses: (CatalogOffering & { avgRating: number; ratingCount: number })[];
        popularTeachers: PopularTeacher[];
      }>('/home')
      .subscribe({
        next: (data) => {
          this.classes.set(data.popularClasses);
          this.teachers.set(data.popularTeachers);
        },
      });
  }

  pastel(subjectName: string | null | undefined) {
    return (
      this.pastelBySubject().get(subjectColorKey(subjectName)) ??
      pastelForSubject(subjectName)
    );
  }

  avatar(teacher: PopularTeacher): string {
    return displayAvatar(this.api.assetUrl(teacher.avatarUrl), teacher.gender);
  }

  onSearch(filters: SearchQuery): void {
    void this.router.navigate(['/subjects'], {
      queryParams: {
        q: filters.q || null,
        level: filters.level || null,
        languages: filters.languages.join(',') || null,
        subjects: filters.subjectIds.join(',') || null,
      },
    });
  }
}

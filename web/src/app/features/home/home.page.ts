import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { CatalogActions, CatalogOffering } from '../catalog/catalog.actions';
import { selectCatalogOfferings } from '../catalog/catalog.selectors';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section>
      <h1>Home</h1>
      <h2>Featured</h2>
      @if (featured().length === 0) {
        <p>No teachers with open hours yet.</p>
      }
      <div class="cards">
        @for (offering of featured(); track offering.id) {
          <article class="card">
            <h2>
              <a [routerLink]="['/subjects', offering.id]">{{ offering.teacherName }}</a>
            </h2>
            <p>{{ offering.title }}</p>
            <p class="meta">{{ offering.openSlotCount }} open slots</p>
          </article>
        }
      </div>
      <h2>Popular</h2>
      <div class="cards">
        @for (offering of offerings(); track offering.id) {
          <article class="card">
            <h2>
              <a [routerLink]="['/subjects', offering.id]">{{ offering.title }}</a>
            </h2>
            <p class="meta">{{ offering.teacherName }} · {{ offering.level }}</p>
            <p>{{ offering.description }}</p>
            <p class="meta">{{ offering.openSlotCount }} open slots</p>
          </article>
        }
      </div>
    </section>
  `,
  styleUrls: ['../catalog/catalog.page.css', './home.page.css'],
})
export class HomePage {
  private readonly store = inject(Store);
  readonly offerings = this.store.selectSignal(selectCatalogOfferings);
  readonly featured = computed(() => {
    const seen = new Set<string>();
    const picked: CatalogOffering[] = [];
    for (const offering of this.offerings()) {
      if (offering.openSlotCount <= 0 || seen.has(offering.teacherId)) {
        continue;
      }
      seen.add(offering.teacherId);
      picked.push(offering);
      if (picked.length === 3) {
        break;
      }
    }
    return picked;
  });

  constructor() {
    this.store.dispatch(CatalogActions.browse({ q: '', level: '' }));
  }
}

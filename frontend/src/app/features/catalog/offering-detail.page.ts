import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';
import { CatalogActions } from './catalog.actions';
import { selectSelectedOffering } from './catalog.selectors';

@Component({
  selector: 'app-offering-detail',
  template: `<p>Opening teacher schedule…</p>`,
})
export class OfferingDetailPage {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.store.dispatch(CatalogActions.loadDetail({ id }));
      }
    });
    this.store
      .select(selectSelectedOffering)
      .pipe(
        filter((offering): offering is NonNullable<typeof offering> => !!offering),
        takeUntilDestroyed(),
      )
      .subscribe((offering) => {
        void this.router.navigate(['/teachers', offering.teacherId], {
          queryParams: { offeringId: offering.id },
          replaceUrl: true,
        });
      });
  }
}

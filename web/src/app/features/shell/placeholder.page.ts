import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  template: `
    <section>
      <h1>{{ title }}</h1>
      @if (title === 'Onboarding') {
        <p>Publish your first offering to continue.</p>
      }
    </section>
  `,
})
export class PlaceholderPage {
  private readonly route = inject(ActivatedRoute);
  readonly title = String(this.route.snapshot.data['title'] ?? '');
}

import { Component, input } from '@angular/core';

/** Areyos "A" logo, optionally with the wordmark and tagline. */
@Component({
  selector: 'app-brand-mark',
  template: `
    <div class="brand" [class.brand--stacked]="stacked()">
      <svg class="brand__logo" [attr.width]="size()" [attr.height]="size()" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 3 45 44 24 33.5 3 44Z" fill="#1854C8" />
        <path d="M24 15.5 35.2 37.6 24 32 12.8 37.6Z" fill="#80AAFF" />
      </svg>
      @if (wordmark()) {
        <div class="brand__text">
          <span class="brand__name">Areyos</span>
          @if (subtitle()) {
            <span class="brand__subtitle">{{ subtitle() }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .brand--stacked {
      flex-direction: column;
      gap: 6px;
      text-align: center;
    }
    .brand__logo {
      flex-shrink: 0;
    }
    .brand__text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .brand__name {
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: -0.01em;
      color: var(--brand-blue);
      line-height: 1.1;
    }
    .brand--stacked .brand__name {
      font-size: 1.9rem;
    }
    .brand__subtitle {
      font-size: 0.75rem;
      color: var(--slate);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .brand--stacked .brand__subtitle {
      font-size: 0.85rem;
      white-space: normal;
    }
  `,
})
export class BrandMark {
  readonly size = input(32);
  readonly wordmark = input(true);
  readonly stacked = input(false);
  readonly subtitle = input<string | null>(null);
}
